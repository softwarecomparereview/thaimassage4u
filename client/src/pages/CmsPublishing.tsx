import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Eye, EyeOff, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Chooses what the public site actually publishes from `listings` — the real
 * table (see worker/publish.ts). The CMS's older "Listings" tab edits a
 * different table that stopped tracking new imports after the one-time 2026
 * sync, so it has no effect on visibility here.
 */

type Row = { slug: string; name: string; city_slug: string; country_code: string; status: string; premium: number; claimed: number; address: string | null; phone: string | null; website: string | null; description: string | null; image_url: string | null; hours: string | null };
type Page = { rows: Row[]; total: number; page: number; pageSize: number; totals: Record<string, number> };

const STATUS_LABEL: Record<string, string> = { published: "Published", pending: "Pending", unpublished: "Unpublished" };

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((parsed as { error?: string }).error ?? "That did not work. Please try again.");
  return parsed;
}

export default function CmsPublishing() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [thinOnly, setThinOnly] = useState(false);
  const [missingRichnessOnly, setMissingRichnessOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
  if (q) params.set("q", q);
  if (thinOnly) params.set("thinOnly", "1");
  if (missingRichnessOnly) params.set("missingRichnessOnly", "1");

  const data = useQuery<Page>({ queryKey: ["publish", status, q, thinOnly, missingRichnessOnly, page], queryFn: () => fetch(`/api/admin/publish?${params}`).then(response => response.json()) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["publish"] });

  const setOne = useMutation({
    mutationFn: ({ slug, next }: { slug: string; next: string }) => postJson("/api/admin/publish/status", { slug, status: next }),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });
  const bulk = useMutation({
    mutationFn: (newStatus: string) => postJson("/api/admin/publish/bulk", { status: status === "all" ? undefined : status, q: q || undefined, thinOnly: thinOnly || undefined, newStatus, protect: true }),
    onSuccess: (result: any) => { toast.success(`${result.updated} listing${result.updated === 1 ? "" : "s"} updated. Claimed and featured listings were never touched.`); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  if (data.isLoading) return <div className="cms-loading">Reading the directory…</div>;
  if (data.error || !data.data) return <div className="cms-error"><CircleAlert size={18} /> Could not load the publish queue.</div>;

  const { rows, total, totals } = data.data;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function confirmBulk(newStatus: string) {
    const scope = status === "all" ? "every filtered listing" : `every ${STATUS_LABEL[status]?.toLowerCase() ?? status} listing in this filter`;
    if (!window.confirm(`Set ${scope} to ${STATUS_LABEL[newStatus]}? Claimed and featured listings are skipped either way.`)) return;
    bulk.mutate(newStatus);
  }

  return <div className="cms-grid">
    <section className="cms-card">
      <p className="eyebrow">Worker / directory publishing</p>
      <h2>Choose what's live, not just what's scraped.</h2>
      <p>{totals.published ?? 0} published · {totals.pending ?? 0} pending · {totals.unpublished ?? 0} unpublished, out of {(totals.published ?? 0) + (totals.pending ?? 0) + (totals.unpublished ?? 0)} total. A listing set to Pending or Unpublished disappears from the site and the sitemap entirely — same as a slug that never existed.</p>

      <div className="cms-field-grid">
        <label>Status
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </label>
        <label>Search
          <div className="cms-search-input"><Search size={14} /><input value={q} onChange={event => { setQ(event.target.value); setPage(1); }} placeholder="Name or slug" /></div>
        </label>
        <label className="cms-field-grid__toggle">
          <input type="checkbox" checked={thinOnly} onChange={event => { setThinOnly(event.target.checked); setPage(1); }} />
          <span>Thin descriptions only</span>
          <small>Under 240 characters — the importer's stub text.</small>
        </label>
        <label className="cms-field-grid__toggle">
          <input type="checkbox" checked={missingRichnessOnly} onChange={event => { setMissingRichnessOnly(event.target.checked); setPage(1); }} />
          <span>Missing photo, hours or phone</span>
          <small>What's holding a listing back from feeling complete.</small>
        </label>
      </div>

      <div className="cms-card__actions" style={{ marginTop: "1.2rem" }}>
        <Button type="button" variant="outline" disabled={bulk.isPending} onClick={() => confirmBulk("pending")}>Hold back this filter</Button>
        <Button type="button" variant="outline" disabled={bulk.isPending} onClick={() => confirmBulk("published")}>Publish this filter</Button>
      </div>
    </section>

    <section className="cms-card">
      <p className="eyebrow">{total} listing{total === 1 ? "" : "s"} match this filter</p>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Name</th><th>City</th><th>Status</th><th>Contact</th><th>Description</th><th>Richness</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}>Nothing matches this filter.</td></tr>}
            {rows.map(row => {
              const thin = (row.description ?? "").trim().length < 240;
              const contactable = Boolean(row.phone || row.website || row.address);
              const missing = [!row.hours && "hours", !row.image_url && "photo", !row.phone && "phone"].filter(Boolean) as string[];
              return <tr key={row.slug}>
                <td><strong>{row.name}</strong>{row.premium ? <span className="cms-tag cms-tag--premium">Featured</span> : null}{row.claimed ? <span className="cms-tag">Claimed</span> : null}</td>
                <td>{row.city_slug}</td>
                <td><span className={`cms-status cms-status--${row.status}`}>{STATUS_LABEL[row.status] ?? row.status}</span></td>
                <td>{contactable ? "Yes" : <span className="cms-warn">No contact info</span>}</td>
                <td>{thin ? <span className="cms-warn">{(row.description ?? "").trim().length} chars</span> : "OK"}</td>
                <td>{missing.length ? <span className="cms-warn">Missing {missing.join(", ")}</span> : "Complete"}</td>
                <td className="cms-table__actions">
                  {row.status !== "published"
                    ? <Button type="button" size="sm" variant="outline" disabled={setOne.isPending} onClick={() => setOne.mutate({ slug: row.slug, next: "published" })}><Eye size={14} /> Publish</Button>
                    : <Button type="button" size="sm" variant="outline" disabled={setOne.isPending} onClick={() => setOne.mutate({ slug: row.slug, next: "pending" })}><EyeOff size={14} /> Hold back</Button>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && <div className="cms-pager">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page} of {pageCount}</span>
        <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
      </div>}
    </section>
  </div>;
}
