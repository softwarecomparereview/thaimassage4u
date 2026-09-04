// Vanilla TS, no framework, Shadow DOM. Mounted via
// <script src="/concierge/concierge.js" data-site="quiet-hour" data-index="/concierge" defer></script>
// Nothing loads (manifest fetch included) until the launcher is hovered or clicked — see init()
// at the bottom, which only wires event listeners eagerly.

import {
  openGreeting, step, stepAsync,
  type DialogDeps, type DialogInput, type DialogState, type Flow, type IndexListing,
  type IndexManifest, type PageContext, type Scored, type SiteTaxonomy,
} from "@concierge/core";
import { styles } from "./styles.js";

interface WidgetConfig {
  site: string;
  indexBase: string; // e.g. /concierge
  locale: string;
}

type EventName = "open" | "greet" | `ask:${string}` | `answer:${string}` | "results" | "more" | `refine:${string}` | "click:view" | "click:book" | "click:call" | "none" | "unmet" | "close";

function fireEvent(config: WidgetConfig, ev: EventName, data: Record<string, unknown> = {}) {
  // Never blocks the UI — analytics is a side channel, not a dependency.
  try {
    fetch(`${config.indexBase.replace(/\/concierge$/, "")}/api/concierge/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ site: config.site, sid: sessionId(), ev, data, ts: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // localStorage/fetch can throw in locked-down contexts — never let telemetry break the widget.
  }
}

function sessionId(): string {
  try {
    let sid = sessionStorage.getItem("concierge:sid");
    if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("concierge:sid", sid); }
    return sid;
  } catch {
    return "anon";
  }
}

function readPageContext(): PageContext {
  const path = location.pathname;
  const cityMatch = path.match(/^\/city\/([^/]+)/);
  if (cityMatch) return { path, pagePlace: cityMatch[1] };
  const listingMatch = path.match(/^\/listing\/([^/]+)/);
  if (listingMatch) return { path }; // listing's own city is resolved after the manifest loads, in resolveListingPlace()
  const styleMatch = path.match(/^\/style\/([^/]+)/);
  if (styleMatch) return { path, pageFacets: { look: [styleMatch[1]] } };
  return { path };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json() as Promise<T>;
}

class ConciergeWidget {
  private config: WidgetConfig;
  private root: ShadowRoot;
  private launcher!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private chipsEl!: HTMLDivElement;
  private cardsEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;

  private manifest: IndexManifest | null = null;
  private taxonomy: SiteTaxonomy | null = null;
  private flow: Flow | null = null;
  private shardCache = new Map<string, IndexListing[]>();
  private state: DialogState | null = null;
  private manifestPromise: Promise<void> | null = null;

  constructor(host: HTMLElement, config: WidgetConfig) {
    this.config = config;
    this.root = host.attachShadow({ mode: "open" });
    this.render();
    this.prefetchOnIdle();
  }

  private render() {
    const style = document.createElement("style");
    style.textContent = styles;
    this.root.appendChild(style);

    this.launcher = document.createElement("button");
    this.launcher.className = "launcher";
    this.launcher.type = "button";
    this.launcher.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 3.6 19.33L22 22l-1.34-4.53A10 10 0 0 0 12 2Z"/></svg><span>Find my massage</span>`;
    this.launcher.addEventListener("mouseenter", () => this.prefetchManifest(), { once: true });
    this.launcher.addEventListener("click", () => this.open());

    this.panel = document.createElement("div");
    this.panel.className = "panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "Concierge");

    const head = document.createElement("div");
    head.className = "head";
    head.innerHTML = `<span>Concierge</span>`;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close");
    closeButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
    closeButton.addEventListener("click", () => this.close());
    head.appendChild(closeButton);

    this.messagesEl = document.createElement("div");
    this.messagesEl.className = "messages";
    this.messagesEl.setAttribute("aria-live", "polite");

    this.chipsEl = document.createElement("div");
    this.chipsEl.className = "chips";
    this.cardsEl = document.createElement("div");
    this.cardsEl.className = "cards";

    const inputRow = document.createElement("form");
    inputRow.className = "input-row";
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.placeholder = "Or just tell me what you're after…";
    this.inputEl.setAttribute("aria-label", "Message");
    const sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.textContent = "Send";
    inputRow.append(this.inputEl, sendButton);
    inputRow.addEventListener("submit", event => {
      event.preventDefault();
      const value = this.inputEl.value.trim();
      if (!value) return;
      this.inputEl.value = "";
      this.appendMessage("user", value);
      void this.handle({ kind: "text", value });
    });

    this.panel.append(head, this.messagesEl, this.chipsEl, this.cardsEl, inputRow);

    this.root.addEventListener("keydown", (event: Event) => {
      if ((event as KeyboardEvent).key === "Escape") this.close();
    });

    this.root.append(this.launcher, this.panel);
  }

  private prefetchOnIdle() {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (idle) idle(() => this.prefetchManifest());
  }

  private prefetchManifest() {
    if (!this.manifestPromise) this.manifestPromise = this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    const base = this.config.indexBase;
    const [manifest, taxonomy, flow] = await Promise.all([
      fetchJson<IndexManifest>(`${base}/manifest.json`),
      fetchJson<SiteTaxonomy>(`${base}/taxonomy.json`),
      fetchJson<Flow>(`${base}/flow.${this.config.locale}.json`).catch(() => fetchJson<Flow>(`${base}/flow.en.json`)),
    ]);
    this.manifest = manifest;
    this.taxonomy = taxonomy;
    this.flow = flow;
    this.launcher.querySelector("span")!.textContent = `Find my ${flow.noun}`;
  }

  private async loadShard(shardName: string): Promise<IndexListing[]> {
    if (this.shardCache.has(shardName)) return this.shardCache.get(shardName)!;
    const shard = await fetchJson<{ listings: IndexListing[] }>(`${this.config.indexBase}/shards/${shardName}.json`);
    this.shardCache.set(shardName, shard.listings);
    return shard.listings;
  }

  private listingsForPlace = (placeSlug: string): IndexListing[] => {
    // Populated lazily by open()/handle() awaiting loadShard() first — see ensurePlaceLoaded().
    const place = this.manifest?.places.find(p => p.slug === placeSlug);
    if (!place) return [];
    return (this.shardCache.get(place.shard) ?? []).filter(l => l.city === placeSlug);
  };

  private async ensurePlaceLoaded(placeSlug: string | undefined) {
    if (!placeSlug || !this.manifest) return;
    const place = this.manifest.places.find(p => p.slug === placeSlug);
    if (place) await this.loadShard(place.shard);
  }

  private deps(): DialogDeps {
    return { manifest: this.manifest!, taxonomy: this.taxonomy!, flow: this.flow!, listingsForPlace: this.listingsForPlace };
  }

  private resolveListingPlace(ctx: PageContext): PageContext {
    const listingMatch = ctx.path.match(/^\/listing\/([^/]+)/);
    if (!listingMatch) return ctx;
    // A listing page's URL doesn't carry its city — but worker/ssr.tsx already dehydrates the
    // listingBySlug tRPC result into window.__RQ_STATE__ for hydration, and that payload
    // includes `city.slug`. Reading it is free (no extra request) and exact, unlike guessing
    // from a cached "last place" — see client/src/ssr/prefetch.ts for the shape this reads.
    try {
      const state = (window as unknown as { __RQ_STATE__?: { queries?: Array<{ state?: { data?: { city?: { slug?: string } } } }> } }).__RQ_STATE__;
      const citySlug = state?.queries?.map(q => q.state?.data?.city?.slug).find(Boolean);
      if (citySlug) return { ...ctx, pagePlace: citySlug };
    } catch {
      /* window.__RQ_STATE__ absent or unexpected shape — fall through to the plain-path context */
    }
    try {
      const last = localStorage.getItem("concierge:lastPlace");
      if (last) return { ...ctx, pagePlace: last };
    } catch {
      /* ignore */
    }
    return ctx;
  }

  private async open() {
    if (!this.panel.hidden) return;
    fireEvent(this.config, "open");
    await this.prefetchManifestAwaited();
    this.panel.hidden = false;
    this.launcher.hidden = true;
    this.messagesEl.innerHTML = "";
    this.chipsEl.innerHTML = "";
    this.cardsEl.innerHTML = "";

    const ctx = this.resolveListingPlace(readPageContext());
    await this.ensurePlaceLoaded(ctx.pagePlace);
    const result = openGreeting(ctx, this.deps());
    this.state = result.state;
    fireEvent(this.config, "greet");
    this.renderStep(result);
    this.inputEl.focus();
  }

  private async prefetchManifestAwaited() {
    this.prefetchManifest();
    await this.manifestPromise;
  }

  private close() {
    this.panel.hidden = true;
    this.launcher.hidden = false;
    fireEvent(this.config, "close");
  }

  private appendMessage(role: "bot" | "user", text: string) {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private renderCard(scored: Scored) {
    const { listing, reasons, boosted } = scored;
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = listing.imageUrl ?? "";
    img.alt = "";
    if (!listing.imageUrl) img.style.visibility = "hidden";
    const body = document.createElement("div");
    body.className = "body";
    const featuredTag = listing.tier === "featured" ? `<span class="tag">${escapeHtml(this.flow?.featuredLabel ?? "Featured")}</span>` : "";
    body.innerHTML = `
      <h4>${escapeHtml(listing.name)}${featuredTag}</h4>
      <p>${escapeHtml(listing.descriptor ?? "")}</p>
      ${reasons.length ? `<p class="reasons">${reasons.map(escapeHtml).join(" · ")}</p>` : ""}
    `;
    const cta = document.createElement("div");
    cta.className = "cta";
    const viewLink = document.createElement("a");
    viewLink.href = listing.url;
    viewLink.className = "primary";
    viewLink.textContent = "View";
    viewLink.addEventListener("click", () => fireEvent(this.config, "click:view", { listingId: listing.id, boosted }));
    cta.appendChild(viewLink);
    if (listing.bookingUrl) {
      const bookLink = document.createElement("a");
      bookLink.href = listing.bookingUrl;
      bookLink.target = "_blank";
      bookLink.rel = "noreferrer noopener";
      bookLink.textContent = "Book";
      bookLink.addEventListener("click", () => fireEvent(this.config, "click:book", { listingId: listing.id, boosted }));
      cta.appendChild(bookLink);
    }
    if (listing.phone && matchMedia("(max-width: 480px)").matches) {
      const callLink = document.createElement("a");
      callLink.href = `tel:${listing.phone.replace(/[^+\d]/g, "")}`;
      callLink.textContent = "Call";
      callLink.addEventListener("click", () => fireEvent(this.config, "click:call", { listingId: listing.id, boosted }));
      cta.appendChild(callLink);
    }
    body.appendChild(cta);
    card.append(img, body);
    this.cardsEl.appendChild(card);
  }

  private renderStep(result: { messages: { role: "bot" | "user"; text: string }[]; cards?: Scored[]; chips?: string[] }) {
    for (const message of result.messages) this.appendMessage(message.role, message.text);
    this.chipsEl.innerHTML = "";
    this.cardsEl.innerHTML = "";
    for (const chipValue of result.chips ?? []) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = this.chipLabel(chipValue);
      chip.addEventListener("click", () => this.handleChip(chipValue));
      this.chipsEl.appendChild(chip);
    }
    if (result.cards) {
      for (const card of result.cards) this.renderCard(card);
      if (result.cards.length === 0) fireEvent(this.config, "none");
      else fireEvent(this.config, "results", { n: result.cards.length });
      if (this.state?.slots.place) {
        try { localStorage.setItem("concierge:lastPlace", this.state.slots.place); } catch { /* ignore */ }
      }
    }
  }

  private chipLabel(value: string): string {
    const place = this.manifest?.places.find(p => p.slug === value);
    if (place) return place.name;
    for (const facet of this.taxonomy?.facets ?? []) {
      const found = facet.values.find(v => v.slug === value);
      if (found) return found.label;
    }
    const CONTROL_LABELS: Record<string, string> = {
      "Show 3 more": "Show 3 more", "Cheaper": "Cheaper", "Closer": "Closer",
      "Change treatment": "Change treatment", "Change city": "Change city", "Start over": "Start over",
    };
    return CONTROL_LABELS[value] ?? value;
  }

  private async handleChip(value: string) {
    if (!this.state) return;
    const CONTROLS: Record<string, DialogInput["control"]> = {
      "Show 3 more": "more", "Cheaper": "cheaper", "Closer": "closer",
      "Change treatment": "change-treatment", "Change city": "change-city", "Start over": "start-over",
    };
    if (CONTROLS[value]) {
      this.appendMessage("user", value);
      await this.handle({ kind: "control", control: CONTROLS[value] });
      return;
    }
    const slotKey = !this.state.slots.place ? "place" : this.pendingSlotKey();
    this.appendMessage("user", this.chipLabel(value));
    fireEvent(this.config, `answer:${slotKey}` as EventName, { via: "chip" });
    await this.handle({ kind: "chip", slotKey, value });
  }

  private pendingSlotKey(): string {
    return this.state?.asked[this.state.asked.length - 1] ?? "service";
  }

  private async handle(input: DialogInput) {
    if (!this.state) return;
    if (input.kind === "chip" && input.slotKey === "place" && input.value) await this.ensurePlaceLoaded(input.value);
    if (input.kind === "text" && input.value) {
      const place = this.state.slots.place;
      if (place) await this.ensurePlaceLoaded(place);
    }
    const result = await stepAsync(this.state, input, this.deps());
    // A place chosen via free text needs its shard loaded before results render correctly.
    if (result.state.slots.place && result.state.slots.place !== this.state.slots.place) {
      await this.ensurePlaceLoaded(result.state.slots.place);
    }
    this.state = result.state;
    this.renderStep(result);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function init() {
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  const site = scriptEl?.dataset.site ?? "quiet-hour";
  const indexBase = scriptEl?.dataset.index ?? "/concierge";
  const locale = (document.documentElement.lang || "en").slice(0, 2);
  const host = document.createElement("div");
  host.id = "concierge-host";
  document.body.appendChild(host);
  new ConciergeWidget(host, { site, indexBase, locale });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
