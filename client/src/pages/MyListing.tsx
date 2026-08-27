import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { ArrowUpRight, CheckCircle2, KeyRound, Save } from "lucide-react";
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
          <p>If your listing has premium placement, open its page and use "Claim this listing" to get a login code.</p>
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
      </main>
      <SiteFooter />
    </>
  );
}
