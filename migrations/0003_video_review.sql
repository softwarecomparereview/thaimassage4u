CREATE TABLE IF NOT EXISTS video_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT,
  provider TEXT,
  source_url TEXT,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video/mp4',
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_REVIEW','APPROVED','REJECTED','RELEASED')),
  adult_confirmed INTEGER NOT NULL DEFAULT 0,
  consent_confirmed INTEGER NOT NULL DEFAULT 0,
  legal_confirmed INTEGER NOT NULL DEFAULT 0,
  platform_confirmed INTEGER NOT NULL DEFAULT 0,
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  released_at TEXT
);

CREATE TABLE IF NOT EXISTS video_review_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  time_seconds REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(video_id) REFERENCES video_reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_reviews_status_created ON video_reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_review_notes_video_time ON video_review_notes(video_id, time_seconds);
