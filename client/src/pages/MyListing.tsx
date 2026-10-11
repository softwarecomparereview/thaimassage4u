import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { ArrowUpRight, CheckCircle2, KeyRound, Save, TicketPercent } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type OwnerListing = {
  id: number;
  slug: string;
  name: string;
  descriptor: string | null;
  description: string | null;
  neighbourhood: string | null;
  address: string | null;
  bookingUrl: string | null;
  contactEmail: string | null;
  imageUrl: string | null;
};

type Offer = { title: string; details: string | null; terms: string | null; code: string; startsOn: string | null; endsOn: string | null; active: boolean; revealCount: number };
type OfferForm = { title: string; details: string; terms: string; code: string; startsOn: string; endsOn: string; active: boolean };

const EMPTY_OFFER: OfferForm = { title: "", details: "", terms: "", code: "", startsOn: "", endsOn: "", active: true };

function offerStatus(offer: Offer): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!offer.active) return "Paused: customers can't see it";
  if (offer.startsOn && offer.startsOn > today) return `Scheduled: goes live ${offer.startsOn}`;
  if (offer.endsOn && offer.endsOn < today) return `Ended ${offer.endsOn}`;
  return "Live on your listing";
}

/**
 * Owner-run discount voucher (worker/offers.ts). The voucher email's one-click link lands here at
 * #voucher. Leaving the code blank generates one; customers reveal it on the listing page and
 * show it when they book, and every reveal is counted for the owner.
 */
function VoucherEditor() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(EMPTY_OFFER);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/owner/offer")
      .then(response => (response.ok ? response.json() : { offer: null }))
      .then((body: { offer: Offer | null }) => {
        if (!body.offer) return;
        setOffer(body.offer);
        setForm({ title: body.offer.title, details: body.offer.details ?? "", terms: body.offer.terms ?? "", code: body.offer.code, startsOn: body.offer.startsOn ?? "", endsOn: body.offer.endsOn ?? "", active: body.offer.active });
      })
      .catch(() => {})
      .finally(() => { if (window.location.hash === "#voucher") document.getElementById("voucher")?.scrollIntoView({ behavior: "smooth" }); });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/owner/offer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const body: { offer?: Offer; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.offer) { toast.error(body.error ?? "Couldn't save your voucher. Please try again."); return; }
      setOffer(body.offer);
      setForm(current => ({ ...current, code: body.offer!.code }));
      toast.success(offer ? "Voucher updated." : "Your voucher is set up.");
    } catch {
      toast.error("Couldn't save your voucher. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof OfferForm) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }));

  return (
    <section className="owner-listing-form owner-voucher" id="voucher">
      <p className="eyebrow"><TicketPercent size={13} /> Discount voucher, free</p>
      <h2>Give searchers a reason to pick you</h2>
      <p className="owner-voucher__intro">Your voucher shows on your listing and is tagged in the city directory. Customers show the code when they book, and you keep 100% of the payment. There are no fees or commission.</p>
      {offer && <p className="owner-voucher__status"><strong>{offerStatus(offer)}</strong> · {offer.revealCount} {offer.revealCount === 1 ? "customer has" : "customers have"} taken the code</p>}
      <form onSubmit={save}>
        <label>Headline<input required maxLength={80} value={form.title} onChange={set("title")} placeholder="15% off your first visit" /></label>
        <label>Message to customers<textarea rows={3} maxLength={400} value={form.details} onChange={set("details")} placeholder="Welcome to our studio. Mention this voucher when you book any 60 or 90-minute massage." /></label>
        <label>Conditions (optional)<input maxLength={300} value={form.terms} onChange={set("terms")} placeholder="New customers only. Not valid with other offers." /></label>
        <div className="owner-voucher__dates">
          <label>Starts<input type="date" value={form.startsOn} onChange={set("startsOn")} /></label>
          <label>Ends<input type="date" value={form.endsOn} min={form.startsOn || undefined} onChange={set("endsOn")} /></label>
        </div>
        <label>Voucher code<input maxLength={24} value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Leave blank and we'll make one" /></label>
        <label className="owner-voucher__toggle"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} /> Show this voucher on my listing</label>
        <button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving…" : <><Save size={16} /> {offer ? "Update voucher" : "Publish voucher"}</>}</button>
      </form>
    </section>
  );
}

/**
 * The self-service edit page a claimed premium listing's owner lands on
 * after /api/claim/verify. Auth is the same app_session_id cookie every
 * other logged-in route uses — no separate owner UI framework needed.
 */
export default function MyListing() {
  const [state, setState] = useState<"loading" | "unclaimed" | "ready">("loading");
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/owner/listing")
      .then(async response => {
        if (!response.ok) { setState("unclaimed"); return; }
        const body: { listing: OwnerListing } = await response.json();
        setListing(body.listing);
        setState("ready");
      })
      .catch(() => setState("unclaimed"));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!listing) return;
    setSaving(true);
    try {
      const response = await fetch("/api/owner/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          descriptor: listing.descriptor ?? "",
          description: listing.description ?? "",
          neighbourhood: listing.neighbourhood ?? "",
          address: listing.address ?? "",
          bookingUrl: listing.bookingUrl ?? "",
          contactEmail: listing.contactEmail ?? "",
          imageUrl: listing.imageUrl ?? "",
        }),
      });
      const body: { success?: boolean; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) { toast.error(body.error ?? "Couldn't save — please try again."); return; }
      toast.success("Saved.");
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <><SiteHeader /><main className="route-loading">Loading your listing…</main><SiteFooter /></>;

  if (state === "unclaimed") {
    return (
      <>
        <SiteHeader />
        <main className="route-loading">
          <p className="eyebrow"><KeyRound size={14} /> Manage your listing</p>
          <h1>You're not signed in to a claimed listing.</h1>
          <p>Open your listing's page and use "Claim this listing" to get a login code, or use the link in the email we sent you.</p>
          <Link href="/directory" className="text-link">Browse the directory</Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-intro">
          <p className="eyebrow"><CheckCircle2 size={13} /> Signed in</p>
          <h1>{listing?.name}</h1>
          <p>Edits here go live on your public listing immediately.</p>
          <p><Link href="/supplies" className="text-link">Today's cheapest studio supplies, delivered locally <ArrowUpRight size={15} /></Link></p>
        </section>
        <section className="owner-listing-form">
          <form onSubmit={save}>
            <label>Short descriptor<input maxLength={160} value={listing?.descriptor ?? ""} onChange={event => setListing(current => current && { ...current, descriptor: event.target.value })} placeholder="A one-line summary shown near your name" /></label>
            <label>Description<textarea rows={5} value={listing?.description ?? ""} onChange={event => setListing(current => current && { ...current, description: event.target.value })} placeholder="Tell people what makes your studio worth visiting" /></label>
            <label>Neighbourhood<input value={listing?.neighbourhood ?? ""} onChange={event => setListing(current => current && { ...current, neighbourhood: event.target.value })} /></label>
            <label>Address<input value={listing?.address ?? ""} onChange={event => setListing(current => current && { ...current, address: event.target.value })} /></label>
            <label>Booking link<input type="url" value={listing?.bookingUrl ?? ""} onChange={event => setListing(current => current && { ...current, bookingUrl: event.target.value })} placeholder="https://" /></label>
            <label>Contact email<input type="email" value={listing?.contactEmail ?? ""} onChange={event => setListing(current => current && { ...current, contactEmail: event.target.value })} /></label>
            <label>Image URL<input type="url" value={listing?.imageUrl ?? ""} onChange={event => setListing(current => current && { ...current, imageUrl: event.target.value })} placeholder="https://" /></label>
            <button className="dark-button" type="submit" disabled={saving}>{saving ? "Saving…" : <><Save size={16} /> Save changes</>}</button>
          </form>
          {listing && <Link href={`/listing/${listing.slug}`} className="text-link">View your public listing</Link>}
        </section>
        <VoucherEditor />
      </main>
      <SiteFooter />
    </>
  );
}
