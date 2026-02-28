# Changelog

## v2.6.0 — 2026-02-28
- **Breaking**: Replaced `/setup boostserver` subcommand group with new public `/boostserver` top-level command
- Subcommands: create, delete, info, link-set, link-view, link-clear, config-set, mods-list, mods-add, mods-remove, owner-set, owner-view, status-set
- Removed `archive` subcommand (dropped from spec)
- Handler now self-defers (link commands ephemeral, all others standard)
- Autocomplete for server selection fields wired to `/boostserver` command
- `/setup` retains: reports, streak-roles, streak-leaderboard-size, timer-roles
- No logic changes — structure only

## v2.5.6 — 2026-02-28
- **Fix**: Wrapped `getCommands().map(c => c.toJSON())` in try/catch in register.js — previously outside error handling, causing silent crashes
- **Fix**: Wrapped `registerCommands()` call in app.js ready handler with try/catch to prevent unhandled rejections
- **Logging**: Added `[STARTUP] Calling client.login()...` log before Discord login for better deploy diagnostics
- **Logging**: Login success now logs `Discord login() resolved successfully.` to confirm gateway connection

## v2.5.5 — 2026-02-28
- **Security**: `updateBoostServer` now whitelists allowed column names to prevent SQL injection
- **Rollback**: `create` now rolls back channels and roles if DB save fails
- **Autocomplete**: archived servers show `[archived]` status tag in picker
- **Defensive**: `handleLink` now has a fallback return for unreachable code paths

## v2.5.4 — 2026-02-28
- Implemented `/setup boostserver archive`: locks channels, moves to ARCHIVED BOOST SERVERS category, deletes roles, marks DB status archived
- Implemented `/setup boostserver delete`: requires `DELETE server-X` confirmation text, deletes channels, category, roles, and DB record
- Changed delete `confirm` option from boolean to string for safety
- Both commands handle partial failures gracefully with warning fields

## v2.5.3 — 2026-02-28
- Centralized permission model for all `/setup boostserver` subcommands
- `create`: Admin or Guild Owner only
- All other subcommands: Admin, Guild Owner, OR that boost server's owner
- PS Mod role holders cannot execute setup commands
- Server lookup and permission check run once before routing to handlers

## v2.5.2 — 2026-02-28
- Implemented `/setup boostserver link-set`, `link-view`, `link-clear`
- All link responses are ephemeral — ps_link is never posted publicly
- Validates link contains `privateServerLinkCode=` before saving
- Permission: Admins or the specific boost server's owner only
- No console logging of link values

## v2.5.1 — 2026-02-28
- Implemented `/setup boostserver create` with full logic
- Creates category, 3 channels (🔥 main, 👀 proofs, 💬 chat), and 3 roles (Owner, Mod, Booster)
- Assigns owner role automatically; stores all metadata in `boost_servers` DB table
- Added `boost_servers` PostgreSQL table with auto-init on startup
- Wired autocomplete for server selection to query DB
- Updated create options: owner (required), name, game_name, max_players, boost_rate, duration_minutes

## v2.5.0 — 2026-02-28
- Added `/setup boostserver` subcommand group (structure only, no logic yet)
- Subcommands: create, info, owner-set, owner-view, mods-add, mods-remove, mods-list, link-set, link-view, link-clear, status-set, config-set, archive, delete
- Autocomplete wired for server selection fields
- Stub handler responds with "not yet implemented" for all boostserver commands
