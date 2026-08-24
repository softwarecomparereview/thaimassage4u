import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { Mail, MessageSquare, Send, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";

const INTRO_EMAIL_SUBJECT = "You're already listed on Thai Massage For U — here's what that means";
const INTRO_EMAIL_BODY = `<p>Hi {{name}},</p>
<p>Thai Massage For U (thaimassageforu.com) is a directory of independently listed wellness places — and your studio is already on it, alongside real listings across the US, UK, Australia and Germany.</p>
<p>No signup was needed to get listed. If you'd like your page to stand out — appear first in your city, or across all of {{country}} — premium placement now starts at just <strong>$9/week</strong>, no account required, cancel anytime.</p>
<p><a href="https://thaimassageforu.com">See how the directory looks</a></p>
<p>Warmly,<br />The Thai Massage For U team</p>`;

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
  const [audienceSource, setAudienceSource] = useState<"csv" | "city" | "country">("country");
  const [citySlug, setCitySlug] = useState("");
  const [countryCode, setCountryCode] = useState("us");
  const [csvRows, setCsvRows] = useState<{ name?: string; email?: string; phone?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  function switchChannel(next: "email" | "sms") {
    setChannel(next);
    setBody(next === "email" ? INTRO_EMAIL_BODY : INTRO_SMS_BODY);
    setSubject(next === "email" ? INTRO_EMAIL_SUBJECT : "");
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
        body: JSON.stringify({ name, channel, subject: channel === "email" ? subject : undefined, body, audienceSource, citySlug: audienceSource === "city" ? citySlug : undefined, countryCode: audienceSource === "country" ? countryCode : undefined, csvRows: audienceSource === "csv" ? csvRows : undefined }),
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
        <Textarea placeholder="Message body" value={body} onChange={e => setBody(e.target.value)} rows={channel === "email" ? 10 : 4} required />
        <p className="cms-hint">Placeholders: <code>{"{{name}}"}</code> <code>{"{{city}}"}</code> <code>{"{{country}}"}</code></p>

        <div className="cms-audience-picker">
          <label><input type="radio" checked={audienceSource === "country"} onChange={() => setAudienceSource("country")} /> By country</label>
          <label><input type="radio" checked={audienceSource === "city"} onChange={() => setAudienceSource("city")} /> By city</label>
          <label><input type="radio" checked={audienceSource === "csv"} onChange={() => setAudienceSource("csv")} /> Upload CSV</label>
        </div>
        {audienceSource === "country" && (
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)}>
            <option value="us">United States</option><option value="uk">United Kingdom</option><option value="au">Australia</option><option value="de">Germany</option>
          </select>
        )}
        {audienceSource === "city" && (
          <select value={citySlug} onChange={e => setCitySlug(e.target.value)} required>
            <option value="">Choose a city…</option>
            {cities.map((city: any) => <option key={city.id} value={city.slug}>{city.name}</option>)}
          </select>
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
