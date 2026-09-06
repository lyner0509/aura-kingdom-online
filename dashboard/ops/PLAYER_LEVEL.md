# Level Player

Set the level of one character from the dashboard, without touching the
database by hand.

## What it changes

Three things move together in a single transaction on the game database:

| Column | New value |
|---|---|
| `player_characters.level` | the level you chose |
| `player_characters.exp` | `0` — the start of that level |
| `player_classlist.level` (active class only) | the level you chose |

In Aura Kingdom the character level and the level of the class it is
currently playing are stored separately. Writing only
`player_characters.level` leaves the class list stale, and the level
snaps back the next time that class is loaded — so both move together.

Other classes in `player_classlist` are left alone, and so is everything
else: skill points, stats, equipment and inventory are untouched.

`last_level_up_time` is stamped with the moment the change lands.

## Online characters wait

ZoneServer keeps a connected character in memory and writes it back to
the database when the character is saved. A level written underneath a
connected player would simply be overwritten, so:

- **Character offline** — applied immediately.
- **Character online** — stored as a pending assignment. The dashboard
  sweeps every 30 seconds and applies it as soon as that character is no
  longer in the online list, with no further action from the operator.

The online list comes from `aura-dashboard-ctl active-players`, the same
source the Pemain page uses.

One assignment exists per character: setting a new level for a character
that already has a pending one replaces it, so a mistake can be
corrected before it lands.

## Level cap

`PLAYER_LEVEL_CAP` in `/etc/aura-dashboard.env` caps what an operator may
assign; it defaults to **99**. Raise it there when the server's own cap
moves — the page reads the value and shows it.

```bash
# /etc/aura-dashboard.env
PLAYER_LEVEL_CAP=105
```

## Tables

Both live in the `dashboard` schema of the account database, created by
`ops/player-level.sql`:

| Table | Holds |
|---|---|
| `dashboard.player_level_assignment` | one row per character: target level, status, attempts, last error |
| `dashboard.player_level_history` | every queue, apply and cancel, with the operator who did it |

Status is one of `pending`, `applied`, `failed` or `cancelled`. A failed
assignment keeps its error message and can be retried from the page.

## Permissions

The dashboard role needs `SELECT, UPDATE` on `public.player_characters`
and `public.player_classlist` in the game database. `ops/deploy-release.sh`
grants both on every deploy.

## API

All routes require an operator session.

| Route | Purpose |
|---|---|
| `GET /ops/api/player-level` | cap, assignments (with live levels and online flags), history |
| `POST /ops/api/player-level/assign` | `{ player_id, target_level, note? }` |
| `POST /ops/api/player-level/retry` | `{ player_id }` — re-runs a failed assignment |
| `POST /ops/api/player-level/cancel` | `{ player_id }` — drops a pending or failed one |

## Notes

- Assigning the level a character already has is refused; there is
  nothing to do.
- If the character has no row in `player_classlist` for its active class,
  the character level still changes and the response says the class row
  was missing.
- Local preview (`npm run dev`) shows sample rows and refuses every
  write, the same way Paragon Table does.
