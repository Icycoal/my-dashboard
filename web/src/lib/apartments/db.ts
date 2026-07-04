import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Complex, Fee, UtilityEstimate, ScrapeStatus } from "./types";

// SQLite file lives under <project>/data so it survives restarts and is easy to find.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "apartments.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS complexes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      address       TEXT NOT NULL,
      url           TEXT NOT NULL,
      bedrooms      INTEGER NOT NULL DEFAULT 1,
      baseRent      REAL,
      grossRent     REAL,
      concession    TEXT NOT NULL DEFAULT '',
      fees          TEXT NOT NULL DEFAULT '[]',
      oneTimeFees   TEXT NOT NULL DEFAULT '[]',
      utilities     TEXT NOT NULL DEFAULT '[]',
      monthlyTotal  REAL NOT NULL DEFAULT 0,
      notes         TEXT NOT NULL DEFAULT '',
      scrapeStatus  TEXT NOT NULL DEFAULT 'pending',
      scrapeLog     TEXT NOT NULL DEFAULT '[]',
      createdAt     TEXT NOT NULL,
      updatedAt     TEXT NOT NULL
    );
  `);
  // Migrate older databases that predate the concession columns.
  const cols = new Set(
    (db.prepare("PRAGMA table_info(complexes)").all() as { name: string }[]).map((c) => c.name)
  );
  if (!cols.has("grossRent")) db.exec("ALTER TABLE complexes ADD COLUMN grossRent REAL");
  if (!cols.has("concession")) db.exec("ALTER TABLE complexes ADD COLUMN concession TEXT NOT NULL DEFAULT ''");
  _db = db;
  return db;
}

// SQLite stores arrays as JSON text; these helpers (de)serialize the row.
interface Row {
  id: number;
  name: string;
  address: string;
  url: string;
  bedrooms: number;
  baseRent: number | null;
  grossRent: number | null;
  concession: string;
  fees: string;
  oneTimeFees: string;
  utilities: string;
  monthlyTotal: number;
  notes: string;
  scrapeStatus: string;
  scrapeLog: string;
  createdAt: string;
  updatedAt: string;
}

function rowToComplex(row: Row): Complex {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    url: row.url,
    bedrooms: row.bedrooms,
    baseRent: row.baseRent,
    grossRent: row.grossRent ?? null,
    concession: row.concession ?? "",
    fees: JSON.parse(row.fees) as Fee[],
    oneTimeFees: JSON.parse(row.oneTimeFees) as Fee[],
    utilities: JSON.parse(row.utilities) as UtilityEstimate[],
    monthlyTotal: row.monthlyTotal,
    notes: row.notes,
    scrapeStatus: row.scrapeStatus as ScrapeStatus,
    scrapeLog: JSON.parse(row.scrapeLog) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listComplexes(): Complex[] {
  const rows = getDb()
    .prepare("SELECT * FROM complexes ORDER BY monthlyTotal ASC, createdAt DESC")
    .all() as Row[];
  return rows.map(rowToComplex);
}

export function getComplex(id: number): Complex | null {
  const row = getDb().prepare("SELECT * FROM complexes WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? rowToComplex(row) : null;
}

export function insertComplex(input: {
  name: string;
  address: string;
  url: string;
  bedrooms: number;
  notes: string;
}): Complex {
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO complexes (name, address, url, bedrooms, notes, createdAt, updatedAt)
       VALUES (@name, @address, @url, @bedrooms, @notes, @now, @now)`
    )
    .run({ ...input, now });
  return getComplex(Number(info.lastInsertRowid))!;
}

export function updateComplexComputed(
  id: number,
  data: {
    baseRent: number | null;
    grossRent: number | null;
    concession: string;
    fees: Fee[];
    oneTimeFees: Fee[];
    utilities: UtilityEstimate[];
    monthlyTotal: number;
    scrapeStatus: ScrapeStatus;
    scrapeLog: string[];
  }
): Complex | null {
  getDb()
    .prepare(
      `UPDATE complexes SET
         baseRent = @baseRent,
         grossRent = @grossRent,
         concession = @concession,
         fees = @fees,
         oneTimeFees = @oneTimeFees,
         utilities = @utilities,
         monthlyTotal = @monthlyTotal,
         scrapeStatus = @scrapeStatus,
         scrapeLog = @scrapeLog,
         updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run({
      id,
      baseRent: data.baseRent,
      grossRent: data.grossRent,
      concession: data.concession,
      fees: JSON.stringify(data.fees),
      oneTimeFees: JSON.stringify(data.oneTimeFees),
      utilities: JSON.stringify(data.utilities),
      monthlyTotal: data.monthlyTotal,
      scrapeStatus: data.scrapeStatus,
      scrapeLog: JSON.stringify(data.scrapeLog),
      updatedAt: new Date().toISOString(),
    });
  return getComplex(id);
}

export function deleteComplex(id: number): void {
  getDb().prepare("DELETE FROM complexes WHERE id = ?").run(id);
}
