import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Send, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";

/**
 * The lead action here is claiming, not premium — deliberately, after a 2026-08-30 audit found
 * `claims` and `qh_otp_codes` both sitting at 0 rows across the entire directory: nobody has ever
 * started a claim. Campaign #18 sent under the previous version of this template, whose only
 * button read "See your listing & go premium" — a paid ask, first contact, to an owner who'd
 * never heard of the directory. It drew opens and clicks with nothing to show downstream. Premium
 * still gets a mention, but as a secondary line, not the one button in the email — matching the
 * reorder on the listing page itself (ListingDetail.tsx), where ClaimListingBox now renders ahead
 * of the enquiry form for the same reason.
 */
const INTRO_EMAIL_SUBJECT = "You're already listed on Thai Massage For U";
const INTRO_EMAIL_BODY = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1c261f">
  <div style="background:#1f3527;padding:28px 32px;border-radius:8px 8px 0 0">
    <span style="color:#f7f2e9;font-size:20px;font-weight:700;letter-spacing:-0.02em">Thai Massage For U</span>
  </div>
  <div style="background:#fffdf8;padding:32px;border:1px solid #e7ddc9;border-top:none">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Thai Massage For U is a directory of independently listed wellness places — and your studio is already live on it, alongside real listings across the US, UK, Australia and Germany.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 20px">{{city_blurb}}</p>
    <div style="background:#f7f2e9;border-radius:6px;padding:22px;margin:0 0 20px;border:1px solid #e7ddc9">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#2f4a3c">Is this your business?</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Claiming your listing is free — a one-time code to the phone or email already on file, no account or password to set up. Takes about two minutes, and once it's yours you can fix anything we got wrong.</p>
    </div>
    <div style="text-align:center;margin:28px 0">
      <a href="{{listing_url}}" style="background:#2f4a3c;color:#f7f2e9;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:600;display:inline-block">Claim your listing — it's free</a>
    </div>
    <div style="border-radius:6px;padding:16px 20px;margin:0 0 20px;border:1px solid #e7ddc9">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#2f4a3c">Already claimed, or want more?</p>
      <p style="margin:0;font-size:14px;line-height:1.6">Once your listing is yours, premium placement in {{city}} — front of the homepage ribbon, from $9/week, no contract — is one click away on the same page.</p>
    </div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#3a4a3c">Warmly,<br />The Thai Massage For U team</p>
    <div style="border-top:1px solid #e7ddc9;margin-top:8px;padding-top:18px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#8a6a2c">Coming soon</p>
      <p style="margin:0;font-size:13px;line-height:1.55;color:#5c6e64">We're building AI booking and deposit collection next — a booking on your page becomes a real, paid appointment automatically, no back-and-forth. <a href="https://thaimassageforu.com/coming-soon" style="color:#2f4a3c;font-weight:600">See what's next →</a></p>
    </div>
  </div>
</div>`;

/**
 * Voucher outreach: the button is {{offer_url}}, a signed one-click owner link (worker/offers.ts)
 * that claims the listing for the address this email went to and opens the voucher form — no code
 * to type, no account to make. Signed "Jack" as the outreach persona.
 */
const VOUCHER_EMAIL_SUBJECT = "A free way to fill more appointments at {{name}}";
const VOUCHER_EMAIL_BODY = `<div style="display:none;max-height:0;overflow:hidden;opacity:0">List a discount voucher on Thai Massage For U — no fees, no commission, no contract.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f1ea;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#2b2420">
      <tr><td style="background:#7a4a2b;padding:28px 32px">
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f3d9b8">Thai Massage For U · {{city}}</p>
        <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#ffffff;font-weight:normal">More bookings for {{name}}, at no cost to you</h1>
      </td></tr>
      <tr><td style="padding:32px;font-size:16px;line-height:1.6">
        <p style="margin:0 0 16px">Hi {{name}} team,</p>
        <p style="margin:0 0 16px">I'm Jack from <a href="https://thaimassageforu.com" style="color:#7a4a2b">Thai Massage For U</a>, a city-by-city directory that helps people find a proper Thai massage near them. You're already listed with us in {{city}}, and we send people looking for a massage in the city to studios like yours.</p>
        <p style="margin:0 0 16px">We'd like to help more of those visitors become your customers. The idea is simple:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;background:#fbf6ef;border:1px solid #ead9c3;border-radius:10px">
          <tr><td style="padding:20px 24px">
            <p style="margin:0 0 12px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#7a4a2b;font-weight:bold">How it works</p>
            <p style="margin:0 0 10px"><strong>1. You set your offer.</strong> For example, "15% off your first visit" or "$15 off a 90-minute massage". You choose the discount, the start and end dates, and any conditions.</p>
            <p style="margin:0 0 10px"><strong>2. We feature it.</strong> Your voucher appears on your listing and is tagged in the {{city}} directory.</p>
            <p style="margin:0"><strong>3. They book with you.</strong> Customers show their voucher code when they book. You keep 100% of the payment.</p>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-weight:bold">What you get</p>
        <ul style="margin:0 0 24px;padding-left:20px">
          <li style="margin-bottom:6px"><strong>No cost:</strong> no listing fee, no commission and no contract.</li>
          <li style="margin-bottom:6px"><strong>Customers ready to book:</strong> people searching for a massage now, with a reason to choose you.</li>
          <li style="margin-bottom:6px"><strong>You stay in control:</strong> pause, change or end your offer any time, and see how many people have taken it.</li>
        </ul>
        <p style="margin:0 0 24px">It works for both of us. You get new customers, and we get to give people a great deal that brings them back to us.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
          <td style="border-radius:8px;background:#7a4a2b"><a href="{{offer_url}}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Set up my free voucher</a></td>
        </tr></table>
        <p style="margin:0 0 24px;font-size:14px;color:#6b5d52">Takes about two minutes. The button signs you straight in to your listing, with no password or sign-up. This link is just for {{name}}, so please don't forward it.</p>
        <p style="margin:0 0 16px">Prefer email? Just <strong>reply</strong> with the offer you'd like to run and I'll set it up for you.</p>
        <p style="margin:0 0 4px">Warm regards,</p>
        <p style="margin:0 0 4px"><strong>Jack</strong></p>
        <p style="margin:0;color:#6b5d52;font-size:14px">Thai Massage For U · <a href="mailto:hello@thaimassageforu.com" style="color:#6b5d52">hello@thaimassageforu.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>`;

const INTRO_SMS_BODY = `Hi {{name}}, your studio is now listed on Thai Massage For U (thaimassageforu.com) — a wellness directory across the US/UK/AU/DE. Claiming it is free, takes 2 min: {{listing_url}}. Reply STOP to opt out.`;

function parseCsv(text: string): { name?: string; email?: string; phone?: string }[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim());
    const row: Record<string, string> = {};
    header.forEach((key, i) => { if (cells[i]) row[key] = cells[i]; });
    return { name: row.name, email: row.email, phone: row.phone };
  });
}

export default function CmsCampaigns({ cities }: { cities: any[] }) {
  const campaigns = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => fetch("/api/admin/campaigns").then(r => r.json()) });
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [name, setName] = useState("Launch announcement");
  const [subject, setSubject] = useState(INTRO_EMAIL_SUBJECT);
  const [body, setBody] = useState(INTRO_EMAIL_BODY);
  const [audienceSource, setAudienceSource] = useState<"csv" | "city" | "country">("city");
  const [citySlugs, setCitySlugs] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState("us");
  const [csvRows, setCsvRows] = useState<{ name?: string; email?: string; phone?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  function switchChannel(next: "email" | "sms") {
    setChannel(next);
    setBody(next === "email" ? INTRO_EMAIL_BODY : INTRO_SMS_BODY);
    setSubject(next === "email" ? INTRO_EMAIL_SUBJECT : "");
  }

  function toggleCity(slug: string) {
    setCitySlugs(current => current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug]);
  }

  async function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = parseCsv(await file.text());
    setCsvRows(rows);
    toast.success(`Parsed ${rows.length} rows from ${file.name}.`);
  }

  async function createAndSend(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const createResponse = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, channel, subject: channel === "email" ? subject : undefined, body, audienceSource, citySlugs: audienceSource === "city" ? citySlugs : undefined, countryCode: audienceSource === "country" ? countryCode : undefined, csvRows: audienceSource === "csv" ? csvRows : undefined }),
      });
      const created: { campaignId?: number; recipientCount?: number; error?: string } = await createResponse.json();
      if (!createResponse.ok || !created.campaignId) { toast.error(created.error ?? "Couldn't create campaign."); return; }
      const sendResponse = await fetch(`/api/admin/campaigns/${created.campaignId}/send`, { method: "POST" });
      const sent: { queued?: number; error?: string } = await sendResponse.json();
      if (!sendResponse.ok) { toast.error(sent.error ?? "Campaign created but sending failed to start."); return; }
      toast.success(`Sending to ${sent.queued} recipient${sent.queued === 1 ? "" : "s"}.`);
      campaigns.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cms-campaigns">
      <form onSubmit={createAndSend} className="cms-campaign-form">
        <div className="cms-channel-toggle">
          <button type="button" className={channel === "email" ? "is-active" : ""} onClick={() => switchChannel("email")}><Mail size={15} /> Email</button>
          <button type="button" className={channel === "sms" ? "is-active" : ""} onClick={() => switchChannel("sms")}><MessageSquare size={15} /> SMS</button>
        </div>
        {channel === "email" && <div className="cms-channel-toggle">
          <button type="button" className={body === INTRO_EMAIL_BODY ? "is-active" : ""} onClick={() => { setName("Launch announcement"); setSubject(INTRO_EMAIL_SUBJECT); setBody(INTRO_EMAIL_BODY); }}>Intro template</button>
          <button type="button" className={body === VOUCHER_EMAIL_BODY ? "is-active" : ""} onClick={() => { setName("Voucher offer"); setSubject(VOUCHER_EMAIL_SUBJECT); setBody(VOUCHER_EMAIL_BODY); }}>Voucher template</button>
        </div>}
        <Input placeholder="Campaign name" value={name} onChange={e => setName(e.target.value)} required />
        {channel === "email" && <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required />}
        <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={channel === "email" ? 12 : 4} required />
        <p className="cms-hint">Placeholders: <code>{"{{name}}"}</code> <code>{"{{city}}"}</code> <code>{"{{country}}"}</code> <code>{"{{city_blurb}}"}</code> <code>{"{{listing_url}}"}</code> <code>{"{{offer_url}}"}</code> (one-click owner sign-in + voucher setup)</p>
        {channel === "email" && <p className="cms-hint">Every send always CCs aniruddhp@gmail.com and hello@thaimassageforu.com as a live check.</p>}

        <div className="cms-audience-picker">
          <label><input type="radio" checked={audienceSource === "city"} onChange={() => setAudienceSource("city")} /> By city</label>
          <label><input type="radio" checked={audienceSource === "country"} onChange={() => setAudienceSource("country")} /> By country</label>
          <label><input type="radio" checked={audienceSource === "csv"} onChange={() => setAudienceSource("csv")} /> Upload CSV</label>
        </div>
        {audienceSource === "country" && (
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)}>
            <option value="us">United States</option><option value="uk">United Kingdom</option><option value="au">Australia</option><option value="de">Germany</option>
          </select>
        )}
        {audienceSource === "city" && (
          <div className="cms-city-checklist">
            {cities.map((city: any) => (
              <label key={city.id}><input type="checkbox" checked={citySlugs.includes(city.slug)} onChange={() => toggleCity(city.slug)} /> {city.name}</label>
            ))}
          </div>
        )}
        {audienceSource === "csv" && (
          <label className="cms-csv-upload">
            <Upload size={16} /> {csvRows.length ? `${csvRows.length} rows loaded` : "Upload a CSV (columns: name, email, phone)"}
            <input type="file" accept=".csv" onChange={handleCsvFile} hidden />
          </label>
        )}

        <Button type="submit" disabled={busy}><Send size={16} /> {busy ? "Sending…" : "Create & send"}</Button>
      </form>

      <div className="cms-campaign-list">
        <h2>Past campaigns</h2>
        {campaigns.isLoading && <p className="cms-empty">Loading…</p>}
        {campaigns.data?.campaigns?.length ? (
          <table className="cms-stats-table">
            <thead><tr><th>Name</th><th>Channel</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Bounced</th><th>Failed</th></tr></thead>
            <tbody>
              {campaigns.data.campaigns.map((c: any) => (
                <tr key={c.id}><td>{c.name}</td><td>{c.channel}</td><td>{c.status}</td><td>{c.sent ?? 0}</td><td>{c.delivered ?? 0}</td><td>{c.opened ?? 0}</td><td>{c.clicked ?? 0}</td><td>{c.bounced ?? 0}</td><td>{c.failed ?? 0}</td></tr>
              ))}
            </tbody>
          </table>
        ) : !campaigns.isLoading && <p className="cms-empty"><span>—</span>No campaigns sent yet.</p>}
      </div>
    </div>
  );
}
