# Database — Meavo Clock-In

Clock-In uses a **local SQLite** file. Production lives on the VPS at `clock.meavo.app`; dev uses `api/data/meavo.db`.

## Quick inspect (CLI)

From the `api/` folder:

```bash
npm run db:inspect
```

Shows every table, row counts, and the five most recent rows per table.

## Seed sample data (dev only)

```bash
npm run db:seed
```

Adds three workers, card bindings, and today's clock events so you can explore reports and timesheets.

## SQLite shell

```bash
sqlite3 api/data/meavo.db
```

Useful commands:

```sql
.tables
.schema workers
SELECT * FROM workers;
SELECT * FROM clock_events ORDER BY tapped_at DESC LIMIT 20;
SELECT * FROM card_bindings WHERE active = 1;
SELECT * FROM pending_uids WHERE status = 'pending';
```

## GUI tools

Open `api/data/meavo.db` in:

- [DB Browser for SQLite](https://sqlitebrowser.org/) (free, macOS)
- [TablePlus](https://tableplus.com/)
- VS Code extension: **SQLite Viewer**

## Schema overview

| Table | Purpose |
|-------|---------|
| `workers` | Employee profiles |
| `card_bindings` | RFID UID → worker mapping |
| `pending_uids` | Unknown cards waiting for admin assignment (15 min window) |
| `clock_events` | In/out taps with idempotency keys |
| `unassigned_taps` | Audit log of expired pending cards |
| `work_settings` | Shift hours + site timezone (singleton row) |
| `admin_allowlist` | Google SSO emails allowed to sign in |

## Production backup

On the server:

```bash
sqlite3 /opt/meavo-clock-in/api/data/meavo.db ".backup /tmp/meavo-backup.db"
```

Or copy the whole `api/data/` directory while the service is running (WAL mode is safe for read copies).
