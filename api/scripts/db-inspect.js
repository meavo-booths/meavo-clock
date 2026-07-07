#!/usr/bin/env node
/**
 * Print schema, row counts, and recent rows from the Clock-In SQLite database.
 * Usage: npm run db:inspect
 */
import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/meavo.db';

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  console.error('Start the API once (npm run dev) to create it, or run npm run db:seed');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`
  )
  .all()
  .map((r) => r.name);

console.log(`\nMeavo Clock-In database\nPath: ${dbPath}\n`);

for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  console.log(`── ${table} (${count} rows)`);

  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  console.log(`   columns: ${cols.join(', ')}`);

  if (count > 0) {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 5`).all();
    for (const row of rows.reverse()) {
      console.log('  ', JSON.stringify(row));
    }
    if (count > 5) console.log(`   … ${count - 5} older row(s) not shown`);
  }
  console.log();
}

db.close();
