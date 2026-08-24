import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CalendarCheck2, Mail, MapPin, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute, useSearch } from "wouter";

const PREMIUM_TIERS = [
  { tier: "city" as const, label: "Premium city placement", price: "$9 / week" },
  { tier: "country" as const, label: "Premium country placement", price: "$49 / month" },
];

/**
 * Buy premium placement for THIS listing with no account and no claim
 * flow — posts straight to the public /api/premium/checkout route and
 * hands the browser off to Stripe. Anyone who can see this listing page
 * (e.g. via an emailed link) can pay for it directly.
 */
function PremiumPlacementBox({ slug }: { slug: string }) {
  const [pending, setPending] = useState<"city" | "country" | null>(null);

  async function buy(tier: "city" | "country") {
    setPending(tier);
    try {
      const response = await fetch("/api/premium/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingSlug: slug, tier }),
      });
      const body: { checkoutUrl?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkoutUrl) {
        toast.error(body.error ?? "Couldn't start checkout — please try again.");
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch {
      toast.error("Couldn't start checkout — please try again.");
      setPending(null);
    }
  }

  return (
    <aside className="premium-box">
      <p className="eyebrow"><Sparkles size={14} /> Premium placement</p>
      <h2>Get this listing seen first.</h2>
      <p>No account needed — pay once and it's live.</p>
      <div className="premium-box__tiers">
        {PREMIUM_TIERS.map(option => (
          <button key={option.tier} type="button" className="premium-box__tier" disabled={pending !== null} onClick={() => buy(option.tier)}>
            <span>{option.label}</span>
            <strong>{pending === option.tier ? "Redirecting…" : option.price}</strong>
          </button>
        ))}
      </div>
      <span className="premium-box__note">Cancel anytime. Billed securely by Stripe.</span>
    </aside>
  );
}

export default function ListingDetail() {
  const [, params] = useRoute("/listing/:slug");
  const slug = params?.slug ?? "";
  const search = useSearch();
  const { data, isLoading, error } = trpc.directory.listingBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const inquiry = trpc.directory.submitInquiry.useMutation({ onSuccess: () => toast.success("Your inquiry is safely with the Quiet Hour desk."), onError: () => toast.error("That did not send. Please try again.") });
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consentEmail: false, consentSms: false });
  const submit = (event: FormEvent) => { event.preventDefault(); inquiry.mutate({ ...form, listingId: data?.listing.id, phone: form.phone || undefined }); };

  useEffect(() => {
    const premium = new URLSearchParams(search).get("premium");
    if (premium === "success") toast.success("Premium placement is active — thank you!");
    if (premium === "cancelled") toast("Checkout cancelled — no charge was made.");
  }, [search]);

  if (isLoading) return <><SiteHeader /><main className="route-loading">Loading listing…</main></>;
  if (error || !data) return <><SiteHeader /><main className="route-loading"><p className="eyebrow">Directory listing</p><h1>This place is not currently available.</h1><Link href="/directory" className="text-link">Return to the directory <ArrowUpRight size={16} /></Link></main><SiteFooter /></>;
  const { listing, city, category, services } = data;
  return <><SiteHeader /><main>
    <section className="listing-hero"><div className="listing-hero__image" style={listing.imageUrl ? { backgroundImage: `url(${listing.imageUrl})` } : undefined}><span>{category.name}</span></div><div className="listing-hero__copy"><p className="eyebrow">{city.name} / {category.name}</p><h1>{listing.name}</h1><p className="listing-descriptor">{listing.descriptor || "An independently listed wellness place."}</p><p>{listing.description || "This profile is being thoughtfully completed by its owner."}</p><div className="listing-meta">{listing.neighbourhood && <span><MapPin size={16} />{listing.neighbourhood}</span>}{listing.bookingUrl && <a href={listing.bookingUrl} target="_blank" rel="noreferrer"><CalendarCheck2 size={16} /> Book direct <ArrowUpRight size={15} /></a>}</div></div></section>
    <section className="listing-content-grid"><div><p className="eyebrow">The treatment list</p><h2>What you can book</h2><div className="service-list">{services.length ? services.map((service: any) => <article key={service.id}><div><h3>{service.title}</h3><p>{service.description}</p></div><div><span>{service.durationMinutes ? `${service.durationMinutes} min` : "By consultation"}</span>{service.priceFromCents ? <strong>from ${(service.priceFromCents / 100).toFixed(0)}</strong> : null}</div></article>) : <p className="subtle-copy">The studio’s service list is being added.</p>}</div></div><div className="listing-sidebar"><aside className="inquiry-box"><p className="eyebrow">Ask the desk</p><h2>A human introduction is a good place to start.</h2><form onSubmit={submit}><input required placeholder="Your name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><input required type="email" placeholder="Email address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /><input placeholder="Phone, if you prefer" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /><textarea required minLength={12} placeholder="Tell us what you are looking for" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /><label className="consent-row"><input type="checkbox" checked={form.consentEmail} onChange={event => setForm({ ...form, consentEmail: event.target.checked })} /> I’m happy to hear from Quiet Hour by email.</label><label className="consent-row"><input type="checkbox" checked={form.consentSms} onChange={event => setForm({ ...form, consentSms: event.target.checked })} /> I’m happy to hear from Quiet Hour by SMS.</label><button className="dark-button" disabled={inquiry.isPending}>{inquiry.isPending ? "Sending…" : <><Send size={16} /> Send inquiry</>}</button></form><span className="inquiry-note"><Mail size={14} /> Consent is optional and recorded separately for each channel.</span></aside><PremiumPlacementBox slug={listing.slug} /></div></section>
  </main><SiteFooter /></>;
}
