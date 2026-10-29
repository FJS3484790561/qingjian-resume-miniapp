import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  // Each migration and its version are committed together. Never reset an existing database.
  const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
  if (version > 4) { db.close(); throw new Error('数据库版本高于当前程序，请升级服务端') }
  if (version < 1) db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL CHECK(provider IN ('wechat','development')),
      subject TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(provider, subject)
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX sessions_expiry ON sessions(expires_at);
    CREATE TABLE resumes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,id)
    );
    PRAGMA user_version = 1;
    COMMIT;
  `)
  if (version < 2) db.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE resumes ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
    PRAGMA user_version = 2;
    COMMIT;
  `)
  if (version < 3) db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE photos (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      digest TEXT NOT NULL, data BLOB NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
      created_at INTEGER NOT NULL, UNIQUE(user_id,digest)
    );
    CREATE TABLE exports (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL, digest TEXT NOT NULL, title TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('pdf','docx')), state TEXT NOT NULL,
      snapshot TEXT NOT NULL, data BLOB, error TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(user_id,request_id)
    );
    CREATE INDEX exports_owner ON exports(user_id,created_at);
    PRAGMA user_version = 3;
    COMMIT;
  `)
  if (version < 4) db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE ai_jobs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL, digest TEXT NOT NULL, state TEXT NOT NULL,
      source TEXT NOT NULL, section TEXT NOT NULL, result TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '', input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(user_id,request_id)
    );
    CREATE INDEX ai_owner_time ON ai_jobs(user_id,created_at);
    PRAGMA user_version = 4;
    COMMIT;
  `)
  return db
}
