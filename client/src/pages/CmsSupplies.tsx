import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Supplies monetization panel: which offers are actually being watched.
 * Clicks come from /api/supplies/go (worker/supplies.ts) — every outbound
 * offer click on /supplies lands in qh_supply_clicks.
 */

type Stats = {
  byCategory: Array<{ country: string; categoryKey: string; supplier: string; clicks: number }>;
  topOffers: Array<{ title: string; country: string; supplier: string; clicks: number }>;
  last7: Array<{ day: string; clicks: number }>;
};

export default function CmsSupplies() {
  const queryClient = useQueryClient();
  const stats = useQuery<Stats>({ queryKey: ["supply-clicks"], queryFn: () => fetch("/api/admin/supplies/clicks").then(response => response.json()), refetchInterval: 30_000 });
  const sync = useMutation({
    mutationFn: () => fetch("/api/admin/supplies/sync", { method: "POST" }).then(response => response.json()),
    onSuccess: (result: any) => { toast.success(`Refreshed: ${result.aliexpress?.imported ?? 0} AliExpress + ${result.ebay?.imported ?? 0} eBay offers.`); queryClient.invalidateQueries({ queryKey: ["supply-clicks"] }); },
    onError: () => toast.error("Refresh failed — check the Worker logs."),
  });

  if (stats.isLoading) return <div className="cms-loading">Reading supply clicks…</div>;
  if (stats.error || !stats.data) return <div className="cms-error"><CircleAlert size={18} /> Supply stats could not be reached.</div>;

  const total = stats.data.byCategory.reduce((sum, row) => sum + row.clicks, 0);
  const week = stats.data.last7.reduce((sum, row) => sum + row.clicks, 0);

  return <div className="cms-grid">
    <section className="cms-card">
      <header className="cms-card__head">
        <div>
          <p className="eyebrow">Supplies / affiliate clicks</p>
          <h2>{total ? `${total} outbound clicks so far.` : "No clicks recorded yet."}</h2>
          <p>Every offer card on /supplies routes through a tracked redirect. AliExpress clicks carry the affiliate tracking ID, so these are the clicks that can turn into commission.</p>
        </div>
        <div className="cms-card__actions">
          <Button type="button" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}><RefreshCw size={15} /> {sync.isPending ? "Refreshing…" : "Refresh offers now"}</Button>
        </div>
      </header>
      <dl className="cms-stat-row">
        <div><dt>All-time clicks</dt><dd>{total}</dd></div>
        <div><dt>Last 7 days</dt><dd>{week}</dd></div>
        {stats.data.last7.slice(-4).map(row => <div key={row.day}><dt>{row.day.slice(5)}</dt><dd>{row.clicks}</dd></div>)}
      </dl>
    </section>

    <section className="cms-card">
      <p className="eyebrow">By market & category</p>
      <h2>Where the interest is.</h2>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Country</th><th>Category</th><th>Supplier</th><th>Clicks</th></tr></thead>
          <tbody>
            {stats.data.byCategory.length === 0 && <tr><td colSpan={4}>Nothing yet — clicks appear as studios use the page.</td></tr>}
            {stats.data.byCategory.map((row, index) => <tr key={index}><td>{row.country.toUpperCase()}</td><td>{row.categoryKey}</td><td>{row.supplier}</td><td>{row.clicks}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section className="cms-card">
      <p className="eyebrow">Top products</p>
      <h2>What people actually click.</h2>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Product</th><th>Country</th><th>Supplier</th><th>Clicks</th></tr></thead>
          <tbody>
            {stats.data.topOffers.length === 0 && <tr><td colSpan={4}>Nothing yet.</td></tr>}
            {stats.data.topOffers.map((row, index) => <tr key={index}><td>{row.title}</td><td>{row.country.toUpperCase()}</td><td>{row.supplier}</td><td>{row.clicks}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
