import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Send, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";

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
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#2f4a3c">Stand out in {{city}}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">When someone in {{city}} is choosing between studios, premium placement puts you first — before they scroll to whoever's next. At <strong>$9/week</strong>, that's less than the price of a single missed booking, and it pays for itself the first time it works.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6e64">No account, no contract, cancel anytime — we want it to be worth it for you, not a commitment you're stuck with.</p>
    </div>
    <div style="text-align:center;margin:28px 0">
      <a href="https://thaimassageforu.com/{{country_code}}" style="background:#2f4a3c;color:#f7f2e9;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:600;display:inline-block">See your listing &amp; go premium</a>
    </div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#3a4a3c">Warmly,<br />The Thai Massage For U team</p>
    <div style="border-top:1px solid #e7ddc9;margin-top:8px;padding-top:18px">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#8a6a2c">Coming soon</p>
      <p style="margin:0;font-size:13px;line-height:1.55;color:#5c6e64">We're building AI booking and deposit collection next — a booking on your page becomes a real, paid appointment automatically, no back-and-forth. <a href="https://thaimassageforu.com/coming-soon" style="color:#2f4a3c;font-weight:600">See what's next →</a></p>
    </div>
  </div>
</div>`;

const INTRO_SMS_BODY = `Hi {{name}}, your studio is now listed on Thai Massage For U (thaimassageforu.com) — a wellness directory across the US/UK/AU/DE. Want to stand out? Premium placement from $9/wk, no signup needed. Reply STOP to opt out.`;

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
        <Input placeholder="Campaign name" value={name} onChange={e => setName(e.target.value)} required />
        {channel === "email" && <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required />}
        <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={channel === "email" ? 12 : 4} required />
        <p className="cms-hint">Placeholders: <code>{"{{name}}"}</code> <code>{"{{city}}"}</code> <code>{"{{country}}"}</code> <code>{"{{city_blurb}}"}</code></p>
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
