-- Concierge widget event log — see concierge/packages/worker/src/index.ts. §9 of the build
-- brief: funnel (open -> results -> click -> book) and demand-report (asks/zero-results by
-- city × facet) views are both derived from this one table, refreshed nightly (not built yet —
-- P3 scope). Logging failures never surface to the widget; this table not existing yet would
-- just mean handleConciergeEvent's INSERT throws and is caught, not a broken widget.

CREATE TABLE IF NOT EXISTS concierge_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  sid TEXT NOT NULL,
  ev TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS concierge_events_site_ev_idx ON concierge_events(site, ev, created_at);
CREATE INDEX IF NOT EXISTS concierge_events_sid_idx ON concierge_events(sid);
