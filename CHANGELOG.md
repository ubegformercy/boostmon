# Changelog

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
