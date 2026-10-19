CREATE TABLE IF NOT EXISTS ayrton_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ayrton_messages_created_at
  ON ayrton_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ayrton_messages_session_id
  ON ayrton_messages (session_id);

CREATE TABLE IF NOT EXISTS ayrton_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  neurons REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ayrton_usage_created_at
  ON ayrton_usage (created_at DESC);

CREATE TABLE IF NOT EXISTS ayrton_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  approved INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ayrton_knowledge_active
  ON ayrton_knowledge (approved, active, priority DESC, updated_at DESC);
