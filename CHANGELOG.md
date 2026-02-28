# Changelog

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
