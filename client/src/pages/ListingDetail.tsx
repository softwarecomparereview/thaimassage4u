import { Concierge } from "@/components/Concierge";
import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trackEvent } from "@/lib/analytics";
import { langForCountry, STRINGS, type Lang } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { formatPremiumPrice } from "@shared/pricing";
import { ArrowUpRight, CalendarCheck2, KeyRound, Mail, MapPin, Phone, Send, Sparkles, Star, TicketPercent } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute, useSearch } from "wouter";

/**
 * Prices come from shared/pricing.ts. They were previously hard-coded here as
 * $9/$49 while /list-your-place advertised $21/$159 — two public prices for the
 * same product, and only one of them was what Stripe charged.
 *
 * Tier labels are localized client-side (STRINGS[lang].premiumBox.tierLabels) — the tier CODE
 * ("city"/"country") sent to Stripe never changes, only the on-screen text. shared/pricing.ts's
 * own labels stay English-only on purpose: they also name the Stripe product/line-item, which
 * this session deliberately leaves untouched rather than risk drifting from what Stripe's own
 * dashboard shows for reconciliation.
 */
function checkoutTiers(lang: Lang) {
  return (["city", "country"] as const).map(tier => ({
    tier,
    label: STRINGS[lang].premiumBox.tierLabels[tier],
    price: formatPremiumPrice(tier),
  }));
}

/**
 * Buy premium placement for THIS listing with no account and no claim
 * flow — posts straight to the public /api/premium/checkout route and
 * hands the browser off to Stripe. Anyone who can see this listing page
 * (e.g. via an emailed link) can pay for it directly.
 */
function PremiumPlacementBox({ slug, lang }: { slug: string; lang: Lang }) {
  const [pending, setPending] = useState<"city" | "country" | null>(null);
  const t = STRINGS[lang].premiumBox;
  const tiers = checkoutTiers(lang);

  async function buy(tier: "city" | "country") {
    setPending(tier);
    trackEvent("premium_checkout_start", { listing_slug: slug, tier });
    try {
      const response = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingSlug: slug, tier }),
      });
      const body: { checkoutUrl?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkoutUrl) {
        toast.error(body.error ?? t.checkoutError);
        trackEvent("premium_checkout_error", { listing_slug: slug, tier });
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch {
      toast.error(t.checkoutError);
      trackEvent("premium_checkout_error", { listing_slug: slug, tier });
      setPending(null);
    }
  }

  return (
    <aside className="premium-box">
      <p className="eyebrow"><Sparkles size={14} /> {t.eyebrow}</p>
      <h2>{t.headline}</h2>
      <p>{t.subhead}</p>
      <div className="premium-box__tiers">
        {tiers.map(option => (
          <button key={option.tier} type="button" className="premium-box__tier" disabled={pending !== null} onClick={() => buy(option.tier)}>
            <span>{option.label}</span>
            <strong>{pending === option.tier ? t.redirecting : option.price}</strong>
          </button>
        ))}
      </div>
      <span className="premium-box__note">{t.note}</span>
    </aside>
  );
}

/**
 * "for every premium user can we add option for them to claim ownership and
 * give them login to update their own listing. login keep it simple sms or
 * email code" — the code is only ever sent to the contact address already
 * on file for the listing (see worker/claim.ts), so successfully entering
 * it is proof of ownership, not just proof of knowing the listing's slug.
 */
function ClaimListingBox({ slug, lang }: { slug: string; lang: Lang }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"start" | "code">("start");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [maskedAddress, setMaskedAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const t = STRINGS[lang].claimBox;

  async function sendCode(pickedChannel: "email" | "sms") {
    setChannel(pickedChannel);
    setBusy(true);
    try {
      const response = await fetch("/api/claim/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingSlug: slug, channel: pickedChannel }) });
      const body: { maskedAddress?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok) { toast.error(body.error ?? t.sendError); trackEvent("claim_code_error", { listing_slug: slug, channel: pickedChannel }); return; }
      setMaskedAddress(body.maskedAddress ?? "");
      setStep("code");
      trackEvent("claim_code_requested", { listing_slug: slug, channel: pickedChannel });
      toast.success(t.sendSuccess(pickedChannel));
    } catch {
      toast.error(t.sendError);
      trackEvent("claim_code_error", { listing_slug: slug, channel: pickedChannel });
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/claim/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingSlug: slug, channel, code }) });
      const body: { success?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) { toast.error(body.error ?? t.verifyError); trackEvent("claim_verify_error", { listing_slug: slug }); return; }
      trackEvent("claim_verified", { listing_slug: slug, channel });
      toast.success(t.verifySuccess);
      navigate("/my-listing");
    } catch {
      toast.error(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="premium-box">
      <p className="eyebrow"><KeyRound size={14} /> {t.eyebrow}</p>
      <h2>{t.headline}</h2>
      {step === "start" ? (
        <>
          <p>{t.startIntro}</p>
          <div className="premium-box__tiers">
            <button type="button" className="premium-box__tier" disabled={busy} onClick={() => sendCode("email")}><span>{t.emailButton}</span></button>
            <button type="button" className="premium-box__tier" disabled={busy} onClick={() => sendCode("sms")}><span>{t.smsButton}</span></button>
          </div>
        </>
      ) : (
        <form onSubmit={verify}>
          <p>{t.codeIntro(maskedAddress)}</p>
          <input required inputMode="numeric" maxLength={6} placeholder={t.codePlaceholder} value={code} onChange={event => setCode(event.target.value)} />
          <button className="dark-button" type="submit" disabled={busy || code.length < 6}>{busy ? t.verifying : t.verifyButton}</button>
        </form>
      )}
      <span className="premium-box__note">{t.note}</span>
    </aside>
  );
}

type LiveOffer = { title: string; details: string | null; terms: string | null; startsOn: string | null; endsOn: string | null };

function formatOfferDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The owner's live discount voucher (worker/offers.ts), first in the sidebar because it's the
 * strongest reason a searcher has to book this place over the next one. The code is only handed
 * out on "Get voucher" (POST /api/offers/reveal) so the owner sees how many people took it.
 */
function OfferBox({ slug, offer }: { slug: string; offer: LiveOffer }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    try {
      const response = await fetch("/api/offers/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug }) });
      const body: { code?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.code) { toast.error(body.error ?? "Couldn't load the voucher. Please try again."); return; }
      setCode(body.code);
      trackEvent("offer_revealed", { listing_slug: slug });
    } catch {
      toast.error("Couldn't load the voucher. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="premium-box offer-box">
      <p className="eyebrow"><TicketPercent size={14} /> Voucher from this studio</p>
      <h2>{offer.title}</h2>
      {offer.details && <p>{offer.details}</p>}
      {code ? (
        <div className="offer-box__code">
          <span>Your code</span>
          <strong>{code}</strong>
          <small>Show this code or quote it when you book.</small>
        </div>
      ) : (
        <div className="premium-box__tiers"><button type="button" className="premium-box__tier" disabled={busy} onClick={reveal}><span>{busy ? "Loading…" : "Get voucher"}</span><strong>Free</strong></button></div>
      )}
      <span className="premium-box__note">
        {offer.endsOn ? `Valid until ${formatOfferDate(offer.endsOn)}. ` : ""}{offer.terms ?? ""}
      </span>
    </aside>
  );
}

export default function ListingDetail() {
  const [, params] = useRoute("/listing/:slug");
  const slug = params?.slug ?? "";
  const search = useSearch();
  const { data, isLoading, error } = trpc.directory.listingBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const inquiry = trpc.directory.submitInquiry.useMutation({ onSuccess: () => { toast.success("Your inquiry is safely with the Thai Massage For U desk."); trackEvent("inquiry_submitted", { listing_slug: slug }); }, onError: () => toast.error("That did not send. Please try again.") });
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consentEmail: false, consentSms: false });
  const submit = (event: FormEvent) => { event.preventDefault(); inquiry.mutate({ ...form, listingId: data?.listing.id, phone: form.phone || undefined }); };

  useEffect(() => {
    const premium = new URLSearchParams(search).get("premium");
    if (premium === "success") { toast.success("Premium placement is active — thank you!"); trackEvent("premium_purchase", { listing_slug: slug }); }
    if (premium === "cancelled") { toast("Checkout cancelled — no charge was made."); trackEvent("premium_checkout_cancelled", { listing_slug: slug }); }
  }, [search, slug]);

  // One event per listing view, not per render — data.listing.id is stable once loaded, so this
  // fires exactly once per real page view instead of on every state change in the page.
  useEffect(() => {
    if (!data) return;
    trackEvent("view_listing", {
      listing_id: data.listing.id,
      listing_slug: data.listing.slug,
      city: data.city.slug,
      country: data.city.countryCode,
      is_premium: Boolean((data.listing as unknown as { isPremium?: boolean }).isPremium),
      is_claimed: Boolean((data.listing as unknown as { isClaimed?: boolean }).isClaimed),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.listing.id]);

  if (isLoading) return <><SiteHeader /><main className="route-loading">Loading listing…</main></>;
  if (error || !data) return <><SiteHeader /><main className="route-loading"><p className="eyebrow">Directory listing</p><h1>This place is not currently available.</h1><Link href="/directory" className="text-link">Return to the directory <ArrowUpRight size={16} /></Link></main><SiteFooter /></>;
  const { listing, city, category, services } = data;
  const lang = langForCountry(city.countryCode);
  // isPremium/isClaimed only exist on the deployed Worker's tRPC response (worker/directory.ts) —
  // the dev-only Node/Drizzle server this file's types are inferred from (server/routers/directory.ts) predates them.
  const extra = listing as unknown as { isPremium?: boolean; isClaimed?: boolean; phone?: string | null; rating?: number | null; reviewCount?: number | null };
  const isPremium = Boolean(extra.isPremium);
  // Sidebar order matters: 0 rows in `claims` and 0 in `qh_otp_codes` across the entire directory
  // (2026-08-30 audit) means nobody has ever started a claim, and the campaign-email audit that
  // found this also found why — the sidebar led with the consumer "Ask the desk" enquiry form,
  // so an owner who clicked through from their own listing was greeted with a form asking them
  // to introduce themselves to a business they already run. ClaimListingBox now renders first
  // when unclaimed, ahead of the enquiry box, since an owner arriving here is the audience most
  // worth catching before anything else competes for the click.
  const isClaimed = Boolean(extra.isClaimed);
  // `offer` is likewise Worker-only (worker/offers.ts getLiveOffer).
  const offer = (data as unknown as { offer?: LiveOffer | null }).offer ?? null;
  return <><Concierge /><SiteHeader /><main>
    <section className="listing-hero"><div className="listing-hero__image" style={listing.imageUrl ? { backgroundImage: `url(${listing.imageUrl})` } : undefined}><span>{category.name}</span></div><div className="listing-hero__copy"><p className="eyebrow">{city.name} / {category.name}</p><h1>{listing.name}</h1>{isPremium && <p className="listing-featured-flag">Featured — this studio pays for placement</p>}<p className="listing-descriptor">{listing.descriptor || "An independently listed wellness place."}</p><p>{listing.description || "This profile is being thoughtfully completed by its owner."}</p><div className="listing-meta">{listing.neighbourhood && <span><MapPin size={16} />{listing.neighbourhood}</span>}{extra.rating ? <span><Star size={16} />{extra.rating.toFixed(1)}{extra.reviewCount ? ` · ${extra.reviewCount} Google reviews` : ""}</span> : null}{extra.phone && <a href={`tel:${extra.phone.replace(/[^+\d]/g, "")}`} onClick={() => trackEvent("call_click", { listing_slug: slug })}><Phone size={16} /> {extra.phone}</a>}{listing.bookingUrl && <a href={`/api/directory/go?slug=${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer" onClick={() => trackEvent("outbound_click", { listing_slug: slug })}><CalendarCheck2 size={16} /> Book direct <ArrowUpRight size={15} /></a>}</div></div></section>
    <section className="listing-content-grid"><div><p className="eyebrow">The treatment list</p><h2>What you can book</h2><div className="service-list">{services.length ? services.map((service: any) => <article key={service.id}><div><h3>{service.title}</h3><p>{service.description}</p></div><div><span>{service.durationMinutes ? `${service.durationMinutes} min` : "By consultation"}</span>{service.priceFromCents ? <strong>from ${(service.priceFromCents / 100).toFixed(0)}</strong> : null}</div></article>) : <p className="subtle-copy">The studio’s service list is being added.</p>}</div></div><div className="listing-sidebar">{offer && <OfferBox slug={listing.slug} offer={offer} />}{!isClaimed && <ClaimListingBox slug={listing.slug} lang={lang} />}<aside className="inquiry-box"><p className="eyebrow">Ask the desk</p><h2>A human introduction is a good place to start.</h2><form onSubmit={submit}><input required placeholder="Your name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><input required type="email" placeholder="Email address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /><input placeholder="Phone, if you prefer" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /><textarea required minLength={12} placeholder="Tell us what you are looking for" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /><label className="consent-row"><input type="checkbox" checked={form.consentEmail} onChange={event => setForm({ ...form, consentEmail: event.target.checked })} /> I’m happy to hear from Thai Massage For U by email.</label><label className="consent-row"><input type="checkbox" checked={form.consentSms} onChange={event => setForm({ ...form, consentSms: event.target.checked })} /> I’m happy to hear from Thai Massage For U by SMS.</label><button className="dark-button" disabled={inquiry.isPending}>{inquiry.isPending ? "Sending…" : <><Send size={16} /> Send inquiry</>}</button></form><span className="inquiry-note"><Mail size={14} /> Consent is optional and recorded separately for each channel.</span></aside>{!isPremium && <PremiumPlacementBox slug={listing.slug} lang={lang} />}</div></section>
  </main><SiteFooter /></>;
}
