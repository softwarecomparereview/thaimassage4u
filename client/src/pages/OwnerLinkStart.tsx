import { SiteFooter, SiteHeader } from "@/components/SiteFrame";
import { trackEvent } from "@/lib/analytics";
import { KeyRound, TicketPercent } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";

/**
 * Landing page for the one-click owner link in the voucher email ({{offer_url}}, worker/offers.ts).
 * One button press claims the listing (or signs its owner back in) and opens the voucher form.
 * It waits for the press instead of acting on load so link-scanning mail filters, which fetch
 * links without a person behind them, never claim a listing.
 */
export default function OwnerLinkStart() {
  const token = new URLSearchParams(useSearch()).get("t") ?? "";
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? "" : "This link is missing its sign-in code. Open it again from the email we sent you.");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body: { success?: boolean; listingSlug?: string; error?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        setError(body.error ?? "Something went wrong. Please try again.");
        trackEvent("owner_link_error", { status: response.status });
        return;
      }
      trackEvent("owner_link_signed_in", { listing_slug: body.listingSlug ?? "" });
      navigate("/my-listing#voucher");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="route-loading">
        <p className="eyebrow"><TicketPercent size={14} /> Free voucher listing</p>
        <h1>Set up your voucher</h1>
        <p>You'll be signed in to your listing and can choose your discount, its dates and a message for customers. There's no password and no fee.</p>
        <button className="dark-button" type="button" disabled={busy || !token} onClick={start}><KeyRound size={16} /> {busy ? "Signing you in…" : "Continue to my listing"}</button>
        {error && <p className="owner-link-error" role="alert">{error}</p>}
        {error && <p><Link href="/claim" className="text-link">Find and claim your listing another way</Link></p>}
      </main>
      <SiteFooter />
    </>
  );
}
