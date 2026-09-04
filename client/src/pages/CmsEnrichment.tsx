import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Pause, Play, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Control surface for the background listing-enrichment worker: start it, stop
 * it, retune it, run one batch on demand, and read what it wrote. The Worker
 * does the work on its own cron — nothing on this page needs to stay open for
 * a run to finish.
 *
 * This used to be two panels reading two separate backends (worker/enrich.ts
 * and worker/enrichment.ts, built concurrently and merged without either side
 * noticing the other existed) — one card for "descriptions", a second for
 * "deep profiles". They're one engine now; this is one panel.
 */

type Settings = { enabled: boolean; autoPublish: boolean; batchSize: number; concurrency: number; dailyCap: number; model: string; target: "unenriched" | "thin" | "all" };
type Run = { id: number; trigger: string; status: string; attempted: number; succeeded: number; failed: number; skipped: number; note: string | null; started_at: string; finished_at: string | null };
type Item = {
  id: number; listing_slug: string; listing_name: string | null; status: string; source_url: string | null;
  generated_description: string | null; generated_descriptor: string | null; generated_services: string | null; generated_image_url: string | null;
  error: string | null; created_at: string;
};
type Status = {
  settings: Settings; models: string[]; usedToday: number; backlog: number; totals: Record<string, number>;
  directory: { total: number; done: number; withDescriptor: number } | null;
  runs: Run[]; items: Item[];
};

const TARGETS: Array<{ value: Settings["target"]; label: string; hint: string }> = [
  { value: "unenriched", label: "Never attempted", hint: "The normal setting — one pass per listing, then it converges." },
  { value: "thin", label: "Still thin", hint: "Under 240 characters, including ones already attempted." },
  { value: "all", label: "Every listing", hint: "Ignores history entirely. For a full re-run after a prompt or model change." },
];

async function post(path: string, body?: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((parsed as { error?: string }).error ?? "That did not work. Please try again.");
  return parsed;
}

function parseServices(raw: string | null): string[] {
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export default function CmsEnrichment() {
  const queryClient = useQueryClient();
  const status = useQuery<Status>({
    queryKey: ["enrichment"],
    queryFn: () => fetch("/api/admin/enrichment").then(response => response.json()),
    // A run started here finishes on the Worker, so the panel polls rather than
    // holding the request open.
    refetchInterval: 15_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["enrichment"] });

  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => post("/api/admin/enrichment/settings", patch),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });
  const runNow = useMutation({
    mutationFn: () => post("/api/admin/enrichment/run"),
    onSuccess: (result: any) => { toast.success(result.note ?? "Batch finished."); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "approve" | "reject" }) => post(`/api/admin/enrichment/items/${id}/${decision}`),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });
  const approveAll = useMutation({
    mutationFn: () => post("/api/admin/enrichment/approve-all"),
    onSuccess: (result: any) => { toast.success(`${result.approved} listing${result.approved === 1 ? "" : "s"} published.`); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status.isLoading) return <div className="cms-loading">Reading the enrichment worker…</div>;
  if (status.error || !status.data) return <div className="cms-error"><CircleAlert size={18} /> The enrichment worker could not be reached.</div>;

  const { settings, models, usedToday, backlog, totals, directory, runs, items } = status.data;
  const proposals = items.filter(item => item.status === "proposed");
  const field = (patch: Partial<Settings>) => save.mutate(patch);

  return <div className="cms-grid">
    <section className="cms-card">
      <header className="cms-card__head">
        <div>
          <p className="eyebrow">Worker / listing enrichment</p>
          <h2>{settings.enabled ? "Running on the schedule." : "Stopped."}</h2>
          <p>Reads each studio's own website and writes a descriptor, a description and a services list from what the page actually says — plus a photo when one wasn't on file. Runs every 15 minutes on the Worker; nothing needs to stay open.</p>
        </div>
        <div className="cms-card__actions">
          <Button type="button" variant={settings.enabled ? "outline" : "default"} disabled={save.isPending} onClick={() => field({ enabled: !settings.enabled })}>
            {settings.enabled ? <><Pause size={15} /> Stop</> : <><Play size={15} /> Start</>}
          </Button>
          <Button type="button" variant="outline" disabled={runNow.isPending} onClick={() => runNow.mutate()}>
            <RefreshCw size={15} /> {runNow.isPending ? "Running…" : "Run one batch now"}
          </Button>
        </div>
      </header>

      <dl className="cms-stat-row">
        <div><dt>Directory covered</dt><dd>{directory ? `${directory.withDescriptor}/${directory.total}` : "—"}</dd></div>
        <div><dt>Backlog</dt><dd>{backlog}</dd></div>
        <div><dt>Awaiting review</dt><dd>{totals.proposed ?? 0}</dd></div>
        <div><dt>Published</dt><dd>{totals.published ?? 0}</dd></div>
        <div><dt>Skipped</dt><dd>{totals.skipped ?? 0}</dd></div>
        <div><dt>Used today</dt><dd>{usedToday}{settings.dailyCap ? ` / ${settings.dailyCap}` : ""}</dd></div>
      </dl>
    </section>

    <section className="cms-card">
      <p className="eyebrow">Worker attributes</p>
      <h2>What each run is allowed to do.</h2>
      <div className="cms-field-grid">
        <label>Model
          <select value={settings.model} onChange={event => field({ model: event.target.value })}>
            {models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>
        <label>Target
          <select value={settings.target} onChange={event => field({ target: event.target.value as Settings["target"] })}>
            {TARGETS.map(target => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
          <small>{TARGETS.find(target => target.value === settings.target)?.hint}</small>
        </label>
        <label>Listings per run
          <Input type="number" min={1} max={50} defaultValue={settings.batchSize} onBlur={event => field({ batchSize: Number(event.target.value) })} />
          <small>1–50. One run every 15 minutes.</small>
        </label>
        <label>Concurrency
          <Input type="number" min={1} max={8} defaultValue={settings.concurrency} onBlur={event => field({ concurrency: Number(event.target.value) })} />
          <small>1–8 websites fetched at once.</small>
        </label>
        <label>Daily cap
          <Input type="number" min={0} max={5000} defaultValue={settings.dailyCap} onBlur={event => field({ dailyCap: Number(event.target.value) })} />
          <small>0 means no cap. Runs stop for the day once reached.</small>
        </label>
        <label className="cms-field-grid__toggle">
          <input type="checkbox" checked={settings.autoPublish} onChange={event => field({ autoPublish: event.target.checked })} />
          <span>Publish without review</span>
          <small>On by default — this is what has been running in production. Turn off to hold every result for review below instead.</small>
        </label>
      </div>
    </section>

    <section className="cms-card">
      <header className="cms-card__head">
        <div><p className="eyebrow">Review queue</p><h2>{proposals.length ? `${totals.proposed ?? 0} listing${(totals.proposed ?? 0) === 1 ? "" : "s"} waiting.` : "Nothing waiting."}</h2></div>
        {proposals.length > 1 && <Button type="button" variant="outline" disabled={approveAll.isPending} onClick={() => approveAll.mutate()}>Publish all</Button>}
      </header>
      {proposals.length === 0 && <p className="subtle-copy">Only fills up while "Publish without review" is off. Start the worker, or run one batch, and proposals land here.</p>}
      {proposals.map(item => {
        const services = parseServices(item.generated_services);
        return <article key={item.id} className="cms-proposal">
          <div>
            <h3>{item.listing_name ?? item.listing_slug}</h3>
            {item.generated_descriptor && <p className="cms-proposal__descriptor">{item.generated_descriptor}</p>}
            <p>{item.generated_description}</p>
            {services.length > 0 && <p className="cms-proposal__services">{services.join(" · ")}</p>}
            {item.generated_image_url && <a href={item.generated_image_url} target="_blank" rel="noreferrer noopener">New photo found</a>}
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer noopener">{item.source_url}</a>}
          </div>
          <div className="cms-proposal__actions">
            <Button type="button" size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, decision: "approve" })}><Check size={14} /> Publish</Button>
            <Button type="button" size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, decision: "reject" })}><X size={14} /> Discard</Button>
          </div>
        </article>;
      })}
    </section>

    <section className="cms-card">
      <p className="eyebrow">Recent runs</p>
      <h2>What the Worker has been doing.</h2>
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Tried</th><th>Written</th><th>Skipped</th><th>Failed</th><th>Note</th></tr></thead>
          <tbody>
            {runs.length === 0 && <tr><td colSpan={8}>No runs yet.</td></tr>}
            {runs.map(run => <tr key={run.id}>
              <td>{run.started_at}</td>
              <td>{run.trigger}</td>
              <td><span className={`cms-status cms-status--${run.status}`}>{run.status}</span></td>
              <td>{run.attempted}</td><td>{run.succeeded}</td><td>{run.skipped}</td><td>{run.failed}</td>
              <td>{run.note}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {items.some(item => item.error) && <section className="cms-card">
      <p className="eyebrow">Recent problems</p>
      <h2>Listings the worker could not describe.</h2>
      <ul className="cms-problem-list">
        {items.filter(item => item.error).slice(0, 12).map(item => <li key={item.id}>
          <strong>{item.listing_name ?? item.listing_slug}</strong> — {item.error}
        </li>)}
      </ul>
    </section>}
  </div>;
}
