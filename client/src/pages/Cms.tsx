import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, CreditCard, FileText, Globe2, MapPinned, MessageSquareText, Plus, Send, Sparkles, Store } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import CmsCampaigns from "./CmsCampaigns";
import CmsInbox from "./CmsInbox";

const sectionTitles: Record<string, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "Operations / index health", title: "A calm view of the directory.", description: "Manage what the public sees, verify city signals, and keep the content layers useful." },
  listings: { eyebrow: "Directory / studio records", title: "Listings with enough detail to be chosen well.", description: "Draft, review, and publish studio profiles without turning the directory into noise." },
  cities: { eyebrow: "City intelligence / verified only", title: "Map the city behind the listing.", description: "Every event and metric needs a named source, a URL, and a date it was checked." },
  content: { eyebrow: "Journal / editorial desk", title: "Publish guidance with a point of view.", description: "Create drafts, send them to review, and publish only when the article is ready to serve a reader." },
  locales: { eyebrow: "International / native review", title: "Global pages, written like they belong there.", description: "Translation drafts wait for native-language review before they can become public locale pages." },
  messages: { eyebrow: "Communications / consent first", title: "Introduce Quiet Hour without losing the human note.", description: "Keep email and SMS templates orderly, explicit, and ready for the selected delivery provider." },
  campaigns: { eyebrow: "Outreach / email & SMS", title: "Announce the directory, city by city.", description: "Send from hello@thaimassageforu.com or an SMS number, to a CSV upload or every listing in a city or country." },
  inbox: { eyebrow: "Outreach / replies", title: "Every reply, in one place.", description: "Email replies and inbound SMS both land here, whether or not you're checking that mailbox." },
};

function statusTone(status: string) { return `cms-status cms-status--${status.replaceAll("_", "-")}`; }

export default function Cms() {
  const [location] = useLocation();
  const section = location.split("/")[2] || "overview";
  const copy = sectionTitles[section] ?? sectionTitles.overview;
  const summary = trpc.cms.summary.useQuery();
  const utils = trpc.useUtils();
  const [cityForm, setCityForm] = useState({ name: "", slug: "", country: "Thailand", countryCode: "TH", primaryLocale: "en-TH", introduction: "", isActive: true });
  const [articleForm, setArticleForm] = useState({ title: "", slug: "", topic: "Mindfulness", excerpt: "", body: "", coverImageUrl: "", status: "draft" as const });
  const [templateForm, setTemplateForm] = useState({ channel: "email" as const, title: "", subject: "", purpose: "Introduction", body: "", status: "draft" as const });
  const saveCity = trpc.cms.saveCity.useMutation({ onSuccess: () => { toast.success("City saved to the CMS."); utils.cms.summary.invalidate(); setCityForm({ name: "", slug: "", country: "Thailand", countryCode: "TH", primaryLocale: "en-TH", introduction: "", isActive: true }); }, onError: error => toast.error(error.message) });
  const saveArticle = trpc.cms.saveArticle.useMutation({ onSuccess: () => { toast.success("Article saved."); utils.cms.summary.invalidate(); }, onError: error => toast.error(error.message) });
  const saveTemplate = trpc.cms.saveTemplate.useMutation({ onSuccess: () => { toast.success("Template saved."); utils.cms.summary.invalidate(); }, onError: error => toast.error(error.message) });
  const data = summary.data;
  const overviewCards = useMemo(() => [
    { label: "Published listings", value: data?.listings.filter((item: any) => item.status === "published").length ?? 0, icon: Store },
    { label: "Verified city events", value: data?.events.filter((item: any) => item.status === "verified").length ?? 0, icon: MapPinned },
    { label: "Articles in review", value: data?.articles.filter((item: any) => item.status === "review").length ?? 0, icon: FileText },
    { label: "Approved templates", value: data?.templates.filter((item: any) => item.status === "approved").length ?? 0, icon: MessageSquareText },
  ], [data]);

  const submitCity = (event: FormEvent) => { event.preventDefault(); saveCity.mutate(cityForm); };
  const submitArticle = (event: FormEvent) => { event.preventDefault(); saveArticle.mutate({ ...articleForm, coverImageUrl: articleForm.coverImageUrl || undefined, excerpt: articleForm.excerpt || undefined, body: articleForm.body || undefined }); };
  const submitTemplate = (event: FormEvent) => { event.preventDefault(); saveTemplate.mutate({ ...templateForm, subject: templateForm.subject || undefined }); };

  return <DashboardLayout><div className="cms-workspace">
    <header className="cms-head"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="cms-head__signal"><Sparkles size={16} /> Data stays unpublished until review.</div></header>
    {summary.isLoading && <div className="cms-loading">Opening the CMS…</div>}
    {summary.error && <div className="cms-error"><CircleAlert size={18} /> {summary.error.message}</div>}
    {data && <>
      {section === "overview" && <CmsOverview cards={overviewCards} data={data} />}
      {section === "listings" && <CmsListings listings={data.listings} cities={data.cities} categories={data.categories} practitioners={data.practitioners} services={data.services} />}
      {section === "cities" && <CmsCities cityForm={cityForm} setCityForm={setCityForm} submit={submitCity} saving={saveCity.isPending} cities={data.cities} events={data.events} metrics={data.metrics} />}
      {section === "content" && <CmsContent form={articleForm} setForm={setArticleForm} submit={submitArticle} saving={saveArticle.isPending} articles={data.articles} />}
      {section === "locales" && <CmsLocales translations={data.localizedContent} />}
      {section === "messages" && <CmsMessages form={templateForm} setForm={setTemplateForm} submit={submitTemplate} saving={saveTemplate.isPending} templates={data.templates} inquiries={data.inquiries} outbox={data.outbox} />}
      {section === "campaigns" && <CmsCampaigns cities={data.cities} />}
      {section === "inbox" && <CmsInbox />}
    </>}
  </div></DashboardLayout>;
}

function StripeModeToggle() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["stripe-mode"], queryFn: () => fetch("/api/admin/stripe-mode").then(r => r.json()) });
  const [busy, setBusy] = useState(false);

  async function flip() {
    if (!status.data) return;
    const next = status.data.mode === "live" ? "test" : "live";
    setBusy(true);
    try {
      const response = await fetch("/api/admin/stripe-mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: next }) });
      const body = await response.json();
      if (!response.ok) { toast.error(body.error ?? "Couldn't switch Stripe mode."); return; }
      toast.success(`Stripe is now in ${next.toUpperCase()} mode.`);
      queryClient.invalidateQueries({ queryKey: ["stripe-mode"] });
    } finally {
      setBusy(false);
    }
  }

  if (status.isLoading || !status.data) return null;
  const isLive = status.data.mode === "live";
  return (
    <div className={`cms-stripe-toggle ${isLive ? "is-live" : "is-test"}`}>
      <CreditCard size={16} />
      <span>Stripe is in <strong>{isLive ? "LIVE" : "TEST"}</strong> mode — real charges {isLive ? "are" : "are not"} happening.</span>
      <button type="button" onClick={flip} disabled={busy || (isLive ? !status.data.hasTestKey : !status.data.hasLiveKey)}>
        {busy ? "Switching…" : `Flip to ${isLive ? "TEST" : "LIVE"}`}
      </button>
    </div>
  );
}

function CmsOverview({ cards, data }: { cards: any[]; data: any }) {
  return <div className="cms-stack"><StripeModeToggle /><section className="cms-kpis">{cards.map(card => <article key={card.label}><card.icon size={18} /><span>{card.label}</span><strong>{card.value}</strong></article>)}</section><section className="cms-two-up"><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">City desk</p><h2>Review queue</h2></div><MapPinned size={20} /></div><div className="cms-list">{data.events.length ? data.events.slice(0, 4).map((event: any) => <div key={event.id}><span>{event.title}</span><small className={statusTone(event.status)}>{event.status}</small></div>) : <CmsEmpty label="No city events have been entered." />}</div></article><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Localization</p><h2>Native review</h2></div><Globe2 size={20} /></div><div className="cms-list">{data.localizedContent.length ? data.localizedContent.slice(0, 4).map((item: any) => <div key={item.id}><span>{item.title}</span><small className={statusTone(item.status)}>{item.locale} · {item.status}</small></div>) : <CmsEmpty label="Translation records will appear here after a locale draft is created." />}</div></article></section><section className="cms-panel cms-panel--wide"><div className="cms-panel__head"><div><p className="eyebrow">Inbox</p><h2>Latest directory inquiries</h2></div><MessageSquareText size={20} /></div><div className="cms-table">{data.inquiries.length ? data.inquiries.slice(0, 6).map((inquiry: any) => <div key={inquiry.id}><span>{inquiry.name}</span><span>{inquiry.email}</span><span className={statusTone(inquiry.status)}>{inquiry.status.replaceAll("_", " ")}</span></div>) : <CmsEmpty label="No inquiries yet. The public directory form will place new enquiries here." />}</div></section></div>;
}

function CmsListings({ listings, cities, categories, practitioners, services }: { listings: any[]; cities: any[]; categories: any[]; practitioners: any[]; services: any[] }) {
  return <div className="cms-stack"><section className="cms-panel cms-panel--wide"><div className="cms-panel__head"><div><p className="eyebrow">Profile inventory</p><h2>Every listing in one view</h2></div><span className="cms-count">{listings.length} records</span></div>{listings.length ? <div className="cms-table cms-table--listing">{listings.map((listing: any) => <div key={listing.id}><div><strong>{listing.name}</strong><small>{listing.slug}</small></div><span className={statusTone(listing.status)}>{listing.status}</span><span>{listing.isFeatured ? "Featured" : "Standard"}</span></div>)}</div> : <CmsEmpty label={cities.length && categories.length ? "Create your first studio record from the partner workflow." : "Add a city and category first, then create the first studio profile."} />}</section>{listings.length ? <><PremiumCheckoutPanel listings={listings} /><CmsListingDetails listings={listings} practitioners={practitioners} services={services} /></> : null}<section className="cms-note"><CheckCircle2 size={19} /><p>Listings become public only at <strong>published</strong> status. The public profile will never show fabricated ratings or customer reviews.</p></section></div>;
}

function CmsListingDetails({ listings, practitioners, services }: { listings: any[]; practitioners: any[]; services: any[] }) {
  const utils = trpc.useUtils();
  const [listingId, setListingId] = useState(String(listings[0]?.id ?? ""));
  const [service, setService] = useState({ title: "", durationMinutes: "", priceFrom: "", description: "", isBookable: true });
  const [practitioner, setPractitioner] = useState({ name: "", role: "", credentials: "", biography: "" });
  const saveService = trpc.cms.saveService.useMutation({ onSuccess: () => { toast.success("Service saved."); utils.cms.summary.invalidate(); setService({ title: "", durationMinutes: "", priceFrom: "", description: "", isBookable: true }); }, onError: error => toast.error(error.message) });
  const savePractitioner = trpc.cms.savePractitioner.useMutation({ onSuccess: () => { toast.success("Practitioner saved."); utils.cms.summary.invalidate(); setPractitioner({ name: "", role: "", credentials: "", biography: "" }); }, onError: error => toast.error(error.message) });
  const currentServices = services.filter(item => String(item.listingId) === listingId);
  const currentPractitioners = practitioners.filter(item => String(item.listingId) === listingId);
  return <section className="cms-two-up"><form className="cms-panel cms-form" onSubmit={event => { event.preventDefault(); saveService.mutate({ listingId: Number(listingId), title: service.title, durationMinutes: service.durationMinutes ? Number(service.durationMinutes) : undefined, priceFromCents: service.priceFrom ? Math.round(Number(service.priceFrom) * 100) : undefined, description: service.description || undefined, isBookable: service.isBookable }); }}><div className="cms-panel__head"><div><p className="eyebrow">Service menu</p><h2>Add a clear treatment</h2></div><Plus size={20} /></div><label>Listing<select value={listingId} onChange={event => setListingId(event.target.value)}>{listings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Service title<Input required value={service.title} onChange={event => setService({ ...service, title: event.target.value })} placeholder="Traditional Thai massage" /></label><div className="cms-form__split"><label>Minutes<Input inputMode="numeric" value={service.durationMinutes} onChange={event => setService({ ...service, durationMinutes: event.target.value })} placeholder="60" /></label><label>Price from (USD)<Input inputMode="decimal" value={service.priceFrom} onChange={event => setService({ ...service, priceFrom: event.target.value })} placeholder="55" /></label></div><label>Description<Textarea value={service.description} onChange={event => setService({ ...service, description: event.target.value })} /></label><label>Bookability<select value={service.isBookable ? "yes" : "no"} onChange={event => setService({ ...service, isBookable: event.target.value === "yes" })}><option value="yes">Bookable</option><option value="no">Information only</option></select></label><Button type="submit" disabled={saveService.isPending}>{saveService.isPending ? "Saving…" : "Save service"}</Button><div className="cms-list">{currentServices.length ? currentServices.map(item => <div key={item.id}><span>{item.title}</span><small>{item.durationMinutes ? `${item.durationMinutes} min` : "Timing on request"}</small></div>) : <CmsEmpty label="No services attached to this listing yet." />}</div></form><form className="cms-panel cms-form" onSubmit={event => { event.preventDefault(); savePractitioner.mutate({ listingId: Number(listingId), name: practitioner.name, role: practitioner.role || undefined, credentials: practitioner.credentials || undefined, biography: practitioner.biography || undefined }); }}><div className="cms-panel__head"><div><p className="eyebrow">Practitioner profile</p><h2>Introduce the people</h2></div><Plus size={20} /></div><label>Practitioner name<Input required value={practitioner.name} onChange={event => setPractitioner({ ...practitioner, name: event.target.value })} /></label><label>Role<Input value={practitioner.role} onChange={event => setPractitioner({ ...practitioner, role: event.target.value })} placeholder="Massage therapist" /></label><label>Credentials<Textarea value={practitioner.credentials} onChange={event => setPractitioner({ ...practitioner, credentials: event.target.value })} placeholder="Training, registration, or relevant experience" /></label><label>Biography<Textarea value={practitioner.biography} onChange={event => setPractitioner({ ...practitioner, biography: event.target.value })} /></label><Button type="submit" disabled={savePractitioner.isPending}>{savePractitioner.isPending ? "Saving…" : "Save practitioner"}</Button><div className="cms-list">{currentPractitioners.length ? currentPractitioners.map(item => <div key={item.id}><span>{item.name}</span><small>{item.role || "Practitioner"}</small></div>) : <CmsEmpty label="No practitioners attached to this listing yet." />}</div></form></section>;
}

function PremiumCheckoutPanel({ listings }: { listings: any[] }) {
  const [listingId, setListingId] = useState(String(listings[0]?.id ?? ""));
  const [tier, setTier] = useState<"city" | "country">("city");
  const checkout = trpc.cms.checkoutPremium.useMutation({
    onSuccess: ({ checkoutUrl }) => {
      toast.success("Opening secure Stripe Checkout in a new tab.");
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
    },
    onError: error => toast.error(error.message),
  });
  const selected = listings.find(item => String(item.id) === listingId);
  return <section className="cms-panel cms-premium-panel"><div><p className="eyebrow">Premium placement</p><h2>Move a reviewed listing into the city index.</h2><p>City placement is <strong>US$21 per week</strong>; country placement is <strong>US$159 per month</strong>. Both recur until cancelled in Stripe.</p></div><form onSubmit={event => { event.preventDefault(); checkout.mutate({ listingId: Number(listingId), tier }); }}><label>Listing<select value={listingId} onChange={event => setListingId(event.target.value)}>{listings.map(listing => <option key={listing.id} value={listing.id}>{listing.name}</option>)}</select></label><label>Placement tier<select value={tier} onChange={event => setTier(event.target.value as "city" | "country")}><option value="city">City — US$21 / week</option><option value="country">Country — US$159 / month</option></select></label><Button type="submit" disabled={checkout.isPending || !selected}>{checkout.isPending ? "Opening checkout…" : "Continue to Stripe Checkout"}</Button></form></section>;
}

function CmsCities({ cityForm, setCityForm, submit, saving, cities, events, metrics }: any) {
  return <div className="cms-stack"><section className="cms-two-up"><form className="cms-panel cms-form" onSubmit={submit}><div className="cms-panel__head"><div><p className="eyebrow">Add a city</p><h2>Set the coordinates</h2></div><Plus size={20} /></div><label>City name<Input required value={cityForm.name} onChange={event => setCityForm({ ...cityForm, name: event.target.value, slug: cityForm.slug || event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} placeholder="Bangkok" /></label><label>URL slug<Input required value={cityForm.slug} onChange={event => setCityForm({ ...cityForm, slug: event.target.value })} placeholder="bangkok" /></label><div className="cms-form__split"><label>Country<Input required value={cityForm.country} onChange={event => setCityForm({ ...cityForm, country: event.target.value })} /></label><label>Code<Input required maxLength={2} value={cityForm.countryCode} onChange={event => setCityForm({ ...cityForm, countryCode: event.target.value.toUpperCase() })} /></label></div><label>Primary locale<Input required value={cityForm.primaryLocale} onChange={event => setCityForm({ ...cityForm, primaryLocale: event.target.value })} placeholder="en-TH" /></label><label>City introduction<Textarea value={cityForm.introduction} onChange={event => setCityForm({ ...cityForm, introduction: event.target.value })} placeholder="A short, useful local introduction." /></label><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save city"}</Button></form><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Coverage map</p><h2>Published locations</h2></div><MapPinned size={20} /></div><div className="cms-list">{cities.length ? cities.map((city: any) => <div key={city.id}><span>{city.name}, {city.country}</span><small>{city.primaryLocale} · {city.isActive ? "active" : "offline"}</small></div>) : <CmsEmpty label="Start with your first city above." />}</div></article></section><section className="cms-two-up"><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Official events</p><h2>Source-backed calendar</h2></div><CalendarIcon /></div><div className="cms-list">{events.length ? events.map((event: any) => <div key={event.id}><span>{event.title}</span><small className={statusTone(event.status)}>{event.sourceName} · {event.status}</small></div>) : <CmsEmpty label="No event records yet. Add only official or clearly named sources." />}</div></article><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Observed metrics</p><h2>Method before metric</h2></div><Sparkles size={20} /></div><div className="cms-list">{metrics.length ? metrics.map((metric: any) => <div key={metric.id}><span>{metric.label}: {metric.value}</span><small>{metric.isPublished ? "public" : "draft"} · {metric.sourceName}</small></div>) : <CmsEmpty label="Metrics need a defined method, source, and observation date before publication." />}</div></article></section></div>;
}

function CmsContent({ form, setForm, submit, saving, articles }: any) {
  return <div className="cms-stack"><section className="cms-two-up cms-two-up--content"><form className="cms-panel cms-form" onSubmit={submit}><div className="cms-panel__head"><div><p className="eyebrow">New article</p><h2>Draft with care</h2></div><Plus size={20} /></div><label>Article title<Input required minLength={6} value={form.title} onChange={event => setForm({ ...form, title: event.target.value, slug: form.slug || event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></label><label>Slug<Input required minLength={6} value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} /></label><div className="cms-form__split"><label>Topic<Input required value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} /></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option></select></label></div><label>Excerpt<Textarea value={form.excerpt} onChange={event => setForm({ ...form, excerpt: event.target.value })} /></label><label>Article body<Textarea className="cms-long-textarea" value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} /></label><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save article"}</Button></form><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Article records</p><h2>Editorial queue</h2></div><FileText size={20} /></div><div className="cms-list">{articles.length ? articles.map((article: any) => <div key={article.id}><span>{article.title}</span><small className={statusTone(article.status)}>{article.topic} · {article.status}</small></div>) : <CmsEmpty label="The twenty-article content collection will appear here as it enters editorial review." />}</div></article></section></div>;
}

function CmsLocales({ translations }: { translations: any[] }) {
  return <div className="cms-stack"><section className="cms-panel cms-panel--wide"><div className="cms-panel__head"><div><p className="eyebrow">Locale workflow</p><h2>Native review is the publication gate.</h2></div><Globe2 size={20} /></div><p className="cms-copy">Cloudflare Workers AI can help with bounded draft preparation and translation-quality checks, but it cannot publish a locale page without the CMS review state moving through native review.</p><div className="cms-table">{translations.length ? translations.map(item => <div key={item.id}><span>{item.title}</span><span>{item.entityType} · {item.locale}</span><span className={statusTone(item.status)}>{item.status.replaceAll("_", " ")}</span></div>) : <CmsEmpty label="No translated records yet. Build each locale page from an approved research brief, then move it to native review." />}</div></section></div>;
}

function CmsMessages({ form, setForm, submit, saving, templates, inquiries, outbox }: any) {
  const utils = trpc.useUtils();
  const [inquiryId, setInquiryId] = useState(String(inquiries[0]?.id ?? ""));
  const [templateId, setTemplateId] = useState("");
  const [renderedContent, setRenderedContent] = useState("");
  const selectedInquiry = inquiries.find((item: any) => String(item.id) === inquiryId);
  const selectedTemplate = templates.find((item: any) => String(item.id) === templateId);
  const channel = selectedTemplate?.channel as "email" | "sms" | undefined;
  const canQueue = Boolean(selectedInquiry && selectedTemplate && (channel === "email" ? selectedInquiry.consentEmail : selectedInquiry.consentSms && selectedInquiry.phone));
  const queue = trpc.cms.queueMessage.useMutation({ onSuccess: () => { toast.success("Message entered the provider-ready queue."); utils.cms.summary.invalidate(); setRenderedContent(""); }, onError: error => toast.error(error.message) });
  const updateStatus = trpc.cms.updateInquiryStatus.useMutation({ onSuccess: () => { toast.success("Inquiry status updated."); utils.cms.summary.invalidate(); }, onError: error => toast.error(error.message) });
  const chooseTemplate = (value: string) => { setTemplateId(value); const template = templates.find((item: any) => String(item.id) === value); setRenderedContent(template?.body || ""); };
  return <div className="cms-stack"><section className="cms-two-up"><form className="cms-panel cms-form" onSubmit={submit}><div className="cms-panel__head"><div><p className="eyebrow">Template studio</p><h2>Write a better hello</h2></div><Send size={20} /></div><div className="cms-form__split"><label>Channel<select value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value })}><option value="email">Email</option><option value="sms">SMS</option></select></label><label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="approved">Approved</option><option value="archived">Archived</option></select></label></div><label>Template name<Input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="A gentle Quiet Hour introduction" /></label><label>Purpose<Input required value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })} /></label>{form.channel === "email" && <label>Subject<Input value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label>}<label>Message body<Textarea required value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} placeholder="Hello {{name}}," /></label><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save template"}</Button></form><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Delivery control</p><h2>Consent before send</h2></div><CheckCircle2 size={20} /></div><div className="cms-list">{templates.length ? templates.map((template: any) => <div key={template.id}><span>{template.title}</span><small className={statusTone(template.status)}>{template.channel} · {template.status}</small></div>) : <CmsEmpty label="Create the first introduction template here. Delivery remains provider-ready until an email or SMS provider is connected." />}</div><div className="cms-message-meta"><span>{inquiries.length} inquiries in inbox</span><span>{outbox.length} messages in outbox</span></div></article></section><section className="cms-two-up"><article className="cms-panel"><div className="cms-panel__head"><div><p className="eyebrow">Inquiry desk</p><h2>Review the next step</h2></div><MessageSquareText size={20} /></div><div className="cms-list">{inquiries.length ? inquiries.map((inquiry: any) => <div key={inquiry.id} className="cms-inquiry"><span><strong>{inquiry.name}</strong><small>{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ""}</small><small>{inquiry.message}</small><small>Email: {inquiry.consentEmail ? "opted in" : "no consent"} · SMS: {inquiry.consentSms ? "opted in" : "no consent"}</small></span><select aria-label={`Update inquiry status for ${inquiry.name}`} value={inquiry.status} onChange={event => updateStatus.mutate({ id: inquiry.id, status: event.target.value as "new" | "in_progress" | "closed" })}><option value="new">New</option><option value="in_progress">In progress</option><option value="closed">Closed</option></select></div>) : <CmsEmpty label="New public enquiries will appear here with their recorded contact permissions." />}</div></article><form className="cms-panel cms-form" onSubmit={event => { event.preventDefault(); if (selectedTemplate && channel) queue.mutate({ templateId: Number(templateId), inquiryId: Number(inquiryId), channel, renderedContent }); }}><div className="cms-panel__head"><div><p className="eyebrow">Message review</p><h2>Prepare, do not surprise.</h2></div><Send size={20} /></div><label>Inquiry<select required value={inquiryId} onChange={event => setInquiryId(event.target.value)}>{inquiries.map((inquiry: any) => <option key={inquiry.id} value={inquiry.id}>{inquiry.name} · {inquiry.email}</option>)}</select></label><label>Approved template<select required value={templateId} onChange={event => chooseTemplate(event.target.value)}><option value="">Choose an approved template</option>{templates.filter((item: any) => item.status === "approved").map((template: any) => <option key={template.id} value={template.id}>{template.title} · {template.channel}</option>)}</select></label><label>Consent state<span className="cms-consent-state">{selectedTemplate ? (canQueue ? `Eligible for ${channel} queue` : `Consent is missing for ${channel}`) : "Select an approved template to check consent"}</span></label><label>Rendered message<Textarea required value={renderedContent} onChange={event => setRenderedContent(event.target.value)} placeholder="Select an approved template to preview it." /></label><Button type="submit" disabled={!canQueue || queue.isPending}>{queue.isPending ? "Queuing…" : "Queue for provider"}</Button><p className="cms-copy">Queueing does not send a live message. Provider delivery stays disabled until a verified email or SMS service is connected.</p></form></section></div>;
}

function CmsEmpty({ label }: { label: string }) { return <p className="cms-empty"><span>—</span>{label}</p>; }
function CalendarIcon() { return <span className="cms-icon"><MapPinned size={20} /></span>; }
