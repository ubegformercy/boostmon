# Changelog

## v2.7.7 — 2026-03-01
- **Audit**: focused ticket system review — all checks passed
- **Fix**: auto-close timer had broken guild resolution (searched channel cache + iterated all guilds); now uses `server.guild_id` directly
- Verified: no Administrator required, no elevated permissions in overwrites, tickets are private, counter is atomic, panel updates instead of duplicates, permission matrix is correct, no unnecessary tables

## v2.7.6 — 2026-03-01
- Implemented ticket button handlers: ❌ Close, 🔒 Close & Lock, 🗑️ Delete
- **Close Ticket**: creator / PS Mod / PS Owner / Admin — removes creator perms, renames to `closed-ticket-####-<slug>`, posts closure embed
- **Close & Lock**: staff only — removes creator perms, denies SendMessages for @everyone, renames to `locked-ticket-####-<slug>`
- **Delete Ticket**: staff only — deletes channel and removes DB record
- **Auto-close**: blank tickets (no user messages) automatically close after 10 minutes
- Auto-close timer is cancelled when a non-bot user sends a message in the ticket channel
- Added `getTicketById()` and `deleteTicket()` DB helpers
- Exported `cancelAutoClose` for use in messageCreate handler

## v2.7.5 — 2026-03-01
- Anti-spam protections for ticket creation
- 60-second per-user per-server cooldown (in-memory, resets on restart)
- Global safety limit: block new tickets when a boost server has 25+ open/locked tickets
- Membership role check blocks non-members from using the dropdown
- Added `countOpenTickets()` DB helper

## v2.7.4 — 2026-03-01
- Enforce one open ticket per user per boost server
- Query for existing `open` or `locked` tickets before creation; block with ephemeral error + channel mention
- Edge case: if existing ticket channel was manually deleted, auto-close stale DB record and allow new creation
- Added `getOpenTicketByUser()` DB helper

## v2.7.3 — 2026-03-01
- Implemented dropdown ticket creation from the panel in `【🚀】・booster-tickets`
- Verifies caller has PS Member/Mod/Owner role or Admin before creating
- Atomic `ticket_counter` increment (no race conditions)
- Creates `ticket-####-{slug}` channel inside `#X — {Name} Tickets` category
- Channel permissions: @everyone denied, creator gets View+Send+History+Attach, PS Owner/Mod get View+Send+History, bot gets View+Send+Manage
- Inserts ticket row into `boost_server_tickets` table
- Posts header embed with ticket number + category + "blank tickets close in 10 minutes" notice
- Adds 3 buttons: ❌ Close Ticket, 🔒 Close & Lock, 🗑️ Delete Ticket (handlers stubbed)
- Ping logic: sends role pings to ticket channel + optional notifications channel based on `ping_mode` config
- Created `discord/handlers/ticket.js` as dedicated interaction handler module
- Wired `StringSelectMenu` and `Button` interaction routing in `app.js`

## v2.7.2 — 2026-03-01
- Added `/boostserver ticket-setup` — configure ticket panel for a boost server
- Options: title, description, categories (max 6, comma-separated), ping mode (off/mod/owner/both), notifications channel
- Posts embed + dropdown in `【🚀】・booster-tickets` channel; updates in-place if panel already exists
- Saves config to `boost_server_ticket_config` table via upsert
- Permission: PS Owner / Discord Owner / Admin only
- Dropdown `customId` format: `ticket_create:{serverId}` (handler not yet wired)

## v2.7.1 — 2026-03-01
- `/boostserver create` now creates a second category: `#X — {Name} Tickets`
- Added `【🚀】・booster-tickets` panel channel inside tickets category (read-only for users, bot-only send)
- `tickets_category_id` and `channel_ticket_panel_id` stored in DB on create
- Rollback tracks both categories; no orphans on failure
- Header embed and confirm embed now include ticket panel channel
- No elevated permissions in any channel overwrites

## v2.7.0 — 2026-03-01
- **Schema restructure**: Renamed all `boost_servers` columns to consistent naming convention
  - `server_number` → `server_index`, `server_name` → `display_name`
  - Channel columns: `announcements_channel_id` → `channel_announcements_id`, etc.
  - Role columns: `owner_role_id` → `role_owner_id`, etc.
- Added `slug` column with `UNIQUE(guild_id, slug)` constraint
- Added `UNIQUE(guild_id, owner_id)` and `UNIQUE(guild_id, LOWER(display_name))` constraints
- Added `tickets_category_id`, `channel_ticket_panel_id`, `ticket_counter` columns
- Dropped legacy columns: `game_name`, `main_channel_id`, `proofs_channel_id`, `booster_role_id`, `boost_rate`, `duration_minutes`, `max_players`
- Created `boost_server_ticket_config` table (1:1 FK, categories TEXT[], ping_mode, notifications)
- Created `boost_server_tickets` table (FK, ticket_number per server, channel_id, status, timestamps)
- Added CRUD functions: `getTicketConfig`, `upsertTicketConfig`, `incrementTicketCounter`, `createTicket`, `getTicketByChannel`, `getTickets`, `updateTicketStatus`
- Idempotent migration: column renames, adds, drops, slug backfill all run safely on every boot
- Renamed `owner-notes` channel to `mod-chat` (visible to owner + mod roles)
- Updated all handler references (create, link, archive, member, delete)
- Delete handler now cleans up `tickets_category_id` and children on teardown

## v2.6.5 — 2026-02-28
- Hardened `/boostserver delete` — safe teardown with no orphaned resources
- Confirmation now requires `DELETE {Server Name}` (was `DELETE server-X`)
- Orphan channel sweep: any untracked children under the category are deleted before the category itself
- Roles fetched from API (not just cache) to ensure nothing is missed
- Embed now shows exact count of channels/roles removed
- Warnings list uses bullet formatting for readability
- All responses remain ephemeral

## v2.6.4 — 2026-02-28
- Added `/boostserver member-add` — approve a user by granting PS Member role (management only)
- Added `/boostserver member-remove` — revoke PS Member role (management only)
- Both commands validate: user exists in server, role exists, idempotent (no error if already has/doesn't have role)
- Membership grants access to boost server channels and `link-view`
- `link-view` already checks for PS Member/Mod/Owner role (v2.6.2 matrix)
- Updated `delete` handler: now cleans up all 6 channel types + `member_role_id` (deduplicated)
- Updated `archive` handler: now locks/moves all 6 channel types + deletes `member_role_id`
- No member tracking table needed — membership is role-based only

## v2.6.3 — 2026-02-28
- **Security audit**: Verified all `ps_link` handling is secure
- All `link-set`, `link-view`, `link-clear` responses confirmed ephemeral (via top-level `deferReply({ ephemeral: true })`)
- `link-set` validates `privateServerLinkCode=` before storing
- `link-view` gated to PS Member/Mod/Owner role holders + Admins (v2.6.2 matrix)
- `link-clear` removes link from DB completely
- No `console.log` of `ps_link` values anywhere in codebase
- Autocomplete never exposes `ps_link` (only uses name/number/status/id)
- Added security invariant comment block to `handleLink` function

## v2.6.2 — 2026-02-28
- Implemented strict permission enforcement matrix for all `/boostserver` subcommands
- **Anyone**: `create`, `info`, `mods-list`, `owner-view`
- **Server members** (PS Member/Mod/Owner role + Admins): `link-view`
- **Management** (PS Owner + Discord Server Owner + Admins): `delete`, `link-set`, `link-clear`, `config-set`, `mods-add`, `mods-remove`, `owner-set`, `status-set`
- All permission denials are ephemeral with clear role-based messaging
- No hardcoded user IDs — uses Discord permission flags and role cache checks
- Removed stale `archive` label from SUBCOMMAND_LABELS

## v2.6.1 — 2026-02-28
- Implemented `/boostserver create` as self-service — any server member can create their own boost server
- Restrictions: one boost server per owner, case-insensitive unique names, name required
- Creates category `#{index} — {Name}` with 6 channels: 📢 announcements, 🎁 giveaways, 🎉 events, 📸 images, 💬 chat, 🔒 owner-notes (private)
- Creates 3 roles: PS Owner, PS Mod, PS Member
- Creator automatically receives PS Owner role
- Posts structured header embed in announcements channel and pins it
- All command responses are ephemeral
- DB schema: added `announcements_channel_id`, `giveaways_channel_id`, `events_channel_id`, `images_channel_id`, `owner_notes_channel_id`, `member_role_id` columns with auto-migration
- Added `getBoostServerByOwner()` and `getBoostServerByName()` DB helpers
- Full rollback on failure (channels, category, roles)

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
