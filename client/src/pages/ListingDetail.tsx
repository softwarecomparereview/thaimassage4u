import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CalendarCheck2, Mail, MapPin, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

export default function ListingDetail() {
  const [, params] = useRoute("/listing/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading, error } = trpc.directory.listingBySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const inquiry = trpc.directory.submitInquiry.useMutation({ onSuccess: () => toast.success("Your inquiry is safely with the Quiet Hour desk."), onError: () => toast.error("That did not send. Please try again.") });
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consentEmail: false, consentSms: false });
  const submit = (event: FormEvent) => { event.preventDefault(); inquiry.mutate({ ...form, listingId: data?.listing.id, phone: form.phone || undefined }); };
  if (isLoading) return <><SiteHeader /><main className="route-loading">Loading listing…</main></>;
  if (error || !data) return <><SiteHeader /><main className="route-loading"><p className="eyebrow">Directory listing</p><h1>This place is not currently available.</h1><Link href="/directory" className="text-link">Return to the directory <ArrowUpRight size={16} /></Link></main><SiteFooter /></>;
  const { listing, city, category, services } = data;
  return <><SiteHeader /><main>
    <section className="listing-hero"><div className="listing-hero__image" style={listing.imageUrl ? { backgroundImage: `url(${listing.imageUrl})` } : undefined}><span>{category.name}</span></div><div className="listing-hero__copy"><p className="eyebrow">{city.name} / {category.name}</p><h1>{listing.name}</h1><p className="listing-descriptor">{listing.descriptor || "An independently listed wellness place."}</p><p>{listing.description || "This profile is being thoughtfully completed by its owner."}</p><div className="listing-meta">{listing.neighbourhood && <span><MapPin size={16} />{listing.neighbourhood}</span>}{listing.bookingUrl && <a href={listing.bookingUrl} target="_blank" rel="noreferrer"><CalendarCheck2 size={16} /> Book direct <ArrowUpRight size={15} /></a>}</div></div></section>
    <section className="listing-content-grid"><div><p className="eyebrow">The treatment list</p><h2>What you can book</h2><div className="service-list">{services.length ? services.map((service: any) => <article key={service.id}><div><h3>{service.title}</h3><p>{service.description}</p></div><div><span>{service.durationMinutes ? `${service.durationMinutes} min` : "By consultation"}</span>{service.priceFromCents ? <strong>from ${(service.priceFromCents / 100).toFixed(0)}</strong> : null}</div></article>) : <p className="subtle-copy">The studio’s service list is being added.</p>}</div></div><aside className="inquiry-box"><p className="eyebrow">Ask the desk</p><h2>A human introduction is a good place to start.</h2><form onSubmit={submit}><input required placeholder="Your name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><input required type="email" placeholder="Email address" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /><input placeholder="Phone, if you prefer" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /><textarea required minLength={12} placeholder="Tell us what you are looking for" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} /><label className="consent-row"><input type="checkbox" checked={form.consentEmail} onChange={event => setForm({ ...form, consentEmail: event.target.checked })} /> I’m happy to hear from Quiet Hour by email.</label><label className="consent-row"><input type="checkbox" checked={form.consentSms} onChange={event => setForm({ ...form, consentSms: event.target.checked })} /> I’m happy to hear from Quiet Hour by SMS.</label><button className="dark-button" disabled={inquiry.isPending}>{inquiry.isPending ? "Sending…" : <><Send size={16} /> Send inquiry</>}</button></form><span className="inquiry-note"><Mail size={14} /> Consent is optional and recorded separately for each channel.</span></aside></section>
  </main><SiteFooter /></>;
}
