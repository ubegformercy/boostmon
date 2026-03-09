# Changelog

## v2.9.28 — 2026-03-08
- Enhanced `prefixRouter` argument resolution for `b! timer show <role>` with safe role parsing (mention/ID/exact-name) and ambiguous role detection
- Added quoted server name support for `b! boostserver leaders <server>` (example: `"House of Mercy"`) and unquoted resolution when unambiguous
- Added safe ambiguous-server handling with short usage hints instead of unsafe guessing
- Improved whitespace normalization/parsing for prefix command bodies while preserving exact `b! ` activation
- Kept existing slash-equivalent permission checks and generic internal error handling

## v2.9.27 — 2026-03-08
- Added new internal `discord/prefixRouter.js` for prefix command routing on `messageCreate`
- Prefix router enforces exact `b! ` activation, ignores bot/DM messages, normalizes extra spaces, and provides short usage help for unsupported commands
- Added initial routed prefix commands: `b! timer show <role>` and `b! boostserver leaders <server>`
- Prefix routes now call shared command service functions (`services/commandViews.js`) and reuse existing leaders permission check from boostserver handler
- Updated `app.js` to use `routePrefixCommand` from the new prefix router

## v2.9.26 — 2026-03-08
- Added scoped shared command service module for command business logic reuse: `services/commandViews.js`
- Extracted `/timer show` role leaderboard business logic into shared service and updated slash handler to consume it
- Extracted `/boostserver leaders` business logic into shared service and updated boostserver handler to consume it
- Preserved existing slash command outputs/permissions while enabling future prefix routes to call the same service layer

## v2.9.25 — 2026-03-08
- Hardened prefix parser to ignore DMs for guild-only bridged commands (`timer show` and `boostserver leaders`)
- Kept strict activation on exact `b! ` prefix and whitespace normalization for extra spaces after prefix
- Added clearer minimal usage response for unsupported/empty prefix commands

## v2.9.24 — 2026-03-08
- Reworked prefix parser to require exact `b! ` command prefix (with trailing space), ignore bot messages, and trim extra spaces after prefix
- Added initial prefix bridge routes: `b! timer show <role>` and `b! boostserver leaders <server>`
- Prefix routes now call existing slash handlers via an interaction adapter, preserving existing permission checks and output formatting
- Added boost server argument resolver for prefix leaders command using existing guild boost server data
- Invalid/unsupported prefix commands now return short usage hints without exposing internal errors

## v2.9.23 — 2026-03-02
- Added lightweight integrity guard after `/boostserver owner-set` completes
- Guard now verifies PS Owner role holder count and, if multiple users are detected, removes owner role from extras
- Added warning logging for integrity cleanups and mod-chat warning message when extra owner holders are removed

## v2.9.22 — 2026-03-02
- Enhanced `/boostserver owner-set server:<boost_server> new_owner:<user>` with safe ownership transfer flow and 5-minute confirmation token
- Added validation for `new_owner` (must be non-bot guild member) and self-transfer guard (`You are already the owner.`)
- Added Confirm/Cancel ephemeral prompt before transfer; cancel performs no changes
- On confirm, bot now removes PS Owner role from all holders, auto-adds PS Member role to new owner when missing, assigns PS Owner role to new owner, and updates DB owner (`owner_id`)
- Added actor validation for transfer buttons (initiator or admin override with ManageGuild/guild owner); unauthorized response is `Not authorized.`
- Added transfer notifications: mod-chat audit message and DM to new owner
- Added button routing for owner transfer interactions in `app.js`

## v2.9.21 — 2026-03-02
- Implemented `/boostserver owner-view server:<boost_server>` to return an embed with server name and current owner
- Owner resolution now prefers DB owner (`owner_id`) and falls back to PS Owner role holder when needed
- Added multi-owner safety handling: if multiple PS Owner role holders are detected, bot warns, selects the highest-role-positioned member, and logs a staff warning to mod-chat when available
- Shows `No owner set.` when no owner can be resolved

## v2.9.20 — 2026-03-02
- Updated `/timer add` so the `role` option is no longer required
- When `role` is omitted, command now auto-selects the target user's existing timed role in the same guild
- Added clear fallback message when no existing timed role is found and role must be specified manually

## v2.9.19 — 2026-03-02
- Added new `/ping` slash command for quick bot health checks
- `/ping` now returns bot online status, API latency, command latency, and uptime in an embed

## v2.9.18 — 2026-03-02
- Fixed `/boostserver leaders` visibility to post publicly in channel instead of ephemeral "Only you can see this"
- Kept other `/boostserver` subcommands ephemeral; only `leaders` now uses a public initial response

## v2.9.17 — 2026-03-02
- Hardened timer command handlers against undefined/non-array timer results to prevent crashes after restart when in-memory state is empty
- Added safe timer result normalization in `/timer clear`, `/timer remove`, `/timer pause user`, and `/timer resume user`
- Added empty-result guards in `/info`, `/timer show role`, and `/boostserver leaders` payload building so reboot states return clean "no active timers" responses

## v2.9.16 — 2026-03-02
- Enhanced `/boostserver leaders` refresh behavior: any PS Owner/PS Mod/PS Member of that boost server can press `🔄 Refresh`
- Added refresh unauthorized response for non-members: `You are not part of this boost server.`
- Added 5-second per-user cooldown for leaders refresh button to reduce spam/abuse
- Refactored leaders query+embed build into shared payload builder used by both slash output and refresh button updates (no new message creation)

## v2.9.15 — 2026-03-02
- Added `/boostserver leaders server:<boost_server>` to display active timers for members in the selected boost server (PS Owner/PS Mod/PS Member role holders)
- Added permission gate for leaders view: PS Owner role, PS Mod role, Discord server owner, or `ManageGuild`; unauthorized response is `Not authorized.`
- Reused `/timer show role` leaderboard rendering logic by extracting shared timer leaderboard builder (sorting, summary stats, and formatting preserved)
- Added `🔄 Refresh` button for leaders view and button interaction routing to reload current server timer leaderboard
- Added `db.getAllGuildTimers(guildId)` for guild-scoped timer retrieval before filtering by boost server member user IDs

## v2.9.14 — 2026-03-02
- Updated `/boostserver delete` to explicitly include `channel_leaderboard_id` in tracked channel deletion list
- Updated `/boostserver archive` to explicitly include `channel_leaderboard_id` when locking/moving channels
- Ensures `【👑】・leaderboard` is always handled even if category/orphan sweep behavior changes

## v2.9.13 — 2026-03-02
- Added new required boost server channel `【👑】・leaderboard` during `/boostserver create` and wizard setup flow
- Channel order updated so `leaderboard` is created directly below `【📢】・announcements`
- Applied permissions: PS Member read-only (`ViewChannel` + `ReadMessageHistory`), PS Owner/PS Mod full chat/media access (`ViewChannel`, `SendMessages`, `AttachFiles`, `ReadMessageHistory`)
- Added DB support for `channel_leaderboard_id` and included it in overwrite repair + server header summary/confirmation output

## v2.9.12 — 2026-03-02
- Added `/boostserver description` subcommand to let PS Owner/Discord Owner/Admin update a boost server description anytime
- New flow opens a Step-1 style description modal, then shows an embed preview with Confirm/Cancel before saving
- Description is now persisted on `boost_servers.description` and announcements header is updated in place (or created if missing) and kept pinned

## v2.9.11 — 2026-03-02
- Increased `/boostserver create` wizard server description limit from 500 to 1000 characters
- Updated both Step 1 modal and Resume modal input max length to keep behavior consistent
- Updated validation message and backend length check to match the new 1000-character limit

## v2.9.10 — 2026-03-02
- Added race-safe ownership enforcement for non-admin `/boostserver create` using PostgreSQL transaction + advisory lock (`guild_id` + `owner_id`)
- `createBoostServer` now performs atomic owner check and insert for regular members to prevent duplicate ownership under concurrent requests
- Creation flow now returns a clear one-server-limit message when blocked by atomic owner check and rolls back created Discord resources

## v2.9.9 — 2026-03-02
- Fixed `/boostserver create` DB conflict for admins/owners by removing the unique `(guild_id, owner_id)` index on `boost_servers`
- Added startup migration to drop legacy unique owner index and recreate `idx_boost_servers_guild_owner` as a non-unique lookup index
- Resolves `duplicate key value violates unique constraint "idx_boost_servers_guild_owner"` during server creation

## v2.9.8 — 2026-03-02
- Updated `/boostserver create` ownership limit: Discord Server Owners and Administrators can now create multiple boost servers
- Kept one-server ownership limit for regular members
- Applied bypass check in both wizard start and final create execution paths for consistent behavior

## v2.9.7 — 2026-03-02
- Removed `【🔒】・mod-chat` from `/boostserver create` Step 3 public visibility options so it can never be selected as public
- Added defensive wizard state sanitization to strip `mod-chat` from `publicChannels` during Step 2/3 transitions and create-time filtering
- Preserved required-channel behavior (`mod-chat` is still always created in Step 2 and remains private)

## v2.9.6 — 2026-03-02
- Critical security fix: replaced client-trusted `boostmon_auth` JSON cookie authentication with server-side PostgreSQL-backed sessions
- Added `sessions` table and session lifecycle helpers (create, validate, delete, expiry cleanup path)
- OAuth login now creates a cryptographically random session ID and sets signed `boostmon_session` cookie (`httpOnly`, `sameSite=strict`, `secure` in production, 7-day max age)
- Dashboard and auth middleware now validate session IDs against the database on every request; no user or guild authorization data is trusted from client cookie payloads
- Legacy `boostmon_auth` cookie usage removed and actively cleared to force migration/re-login
- Enforced required `COOKIE_SECRET` for signed cookie parsing

## v2.9.5 — 2026-03-01
- Fixed `【🚀】・booster-tickets` to be strictly read-only for human roles: PS Member, PS Mod, and PS Owner now have `ViewChannel` + `ReadMessageHistory` with explicit `SendMessages` denied
- Added explicit `@everyone` deny for `SendMessages` (and `ViewChannel` remains denied) on the ticket panel channel
- Restricted ticket panel bot overwrite to required capabilities (`ViewChannel`, `ReadMessageHistory`, `SendMessages`, `ManageMessages`, `EmbedLinks`) so the bot can post/pin/update the panel message
- Existing server repair remains available via `/boostserver ticket-setup`, which reapplies the corrected panel overwrites without recreating the boost server

## v2.9.4 — 2026-03-01
- Fixed ticket panel visibility: PS Members now have read-only access to `【🚀】・booster-tickets` (can view and read history, cannot send messages)
- Kept Tickets category private to staff/bot with `@everyone` denied `ViewChannel`, preventing broad exposure of actual ticket channels
- Preserved private ticket channel model (creator + PS Owner + PS Mod + admins)
- Added overwrite repair during `/boostserver ticket-setup` so existing servers with incorrect ticket panel permissions are fixed in place

## v2.9.3 — 2026-03-01
- Added `/boostserver leave server:<boost_server>` to let users remove themselves from a boost server by revoking only their PS Member role
- Added leave safety checks: users with PS Owner or PS Mod role are blocked from leaving as staff and shown guidance to transfer ownership or be removed by owner/admin
- Added membership validation for leave: users without the PS Member role receive `You are not a member of this boost server.`
- Added graceful error handling when role removal fails, with ephemeral user-facing failure message and server-side logging
- Added optional mod-chat notification on successful leave: `<user> left the boost server.`

## v2.9.2 — 2026-03-01
- Enhanced `/boostserver create` wizard UX on Step 2 (Channel Selection) and Step 3 (Public Visibility) by adding explicit **Continue** + **Cancel** buttons while retaining select menus
- Changed Step 2 and Step 3 select interactions to update stored selections without auto-advancing, allowing users to adjust options before continuing
- Added Step 2 Continue validation to enforce required channels remain selected: `announcements`, `chat`, and `mod-chat`
- Added Step 3 Continue validation to enforce public visibility choices are a subset of Step 2 channel selections
- Continue now uses current wizard state if no new select interaction occurred, preserving defaults/last saved selections

## v2.9.1 — 2026-03-01
- Audited join + permission changes: verified Owner/Mod access scope, member channel restrictions, private `mod-chat`, authorized-only join approval buttons, DM-failure graceful handling, and no public private-link exposure
- No functional code changes required from this audit

## v2.9.0 — 2026-03-01
- Added `/boostserver join` command to submit join requests for a selected boost server
- Join requests are posted to `【🔒】・mod-chat` with requester mention, owner/mod role mentions, request summary, and Approve/Decline buttons
- Added button authorization guard: only PS Owner, PS Mod, Admin, or Discord server owner can approve/decline (`Not authorized.` for others)
- Approve flow grants PS Member role, sends welcome DM, and logs approver confirmation in mod-chat
- Decline flow sends declined DM and logs decliner confirmation in mod-chat
- Added in-memory pending request tracking with 10-minute TTL and duplicate pending request prevention per user+server

## v2.8.6 — 2026-03-01
- Added welcome DM when a user is granted the `PS Member • <Name>` role via `/boostserver member-add`
- DM includes server name and owner display name guidance (no private server link exposure)
- DM delivery fails gracefully when user DMs are disabled, with warning log only (no command crash)

## v2.8.5 — 2026-03-01
- Updated `/boostserver create` permission overwrite matrix: PS Owner/PS Mod now receive full channel access (view/send/history/attach/embeds) across boost server channels
- Applied channel-specific PS Member restrictions (`announcements/giveaways/events` read-only, `images` upload-enabled, `chat` text-enabled, `mod-chat` hidden)
- Enforced private tickets scope: tickets category always private, PS Member hidden by default, and `@everyone` never receives `SendMessages`
- Added overwrite repair routine for existing servers and wired it to `/boostserver config-set` as an admin-triggered reapply path
- Hardened `mod-chat` to remain private even if selected in public visibility options

## v2.8.4 — 2026-03-01
- Audited boost server creation permission model: no Administrator required, no elevated `ManageRoles`/`ManageChannels` overwrites, tickets category remains private, and `@everyone` never gets `SendMessages` through public visibility
- Hardened public visibility handling to only honor `publicChannels` that are also in the selected channel set (prevents accidental public category mode from invalid payload values)

## v2.8.3 — 2026-03-01
- Hardened boost server setup wizard lifecycle: explicit 5-minute expiry handling, robust cleanup, and safe interaction handling when Discord interactions expire
- Added Resume/Cancel flow when an active wizard already exists for the same user+guild
- Added wizard step tracking so Resume returns users to the correct step
- Ensured wizard state is cleaned after cancel, completion, and timeout (no partial creation before Confirm)

## v2.8.2 — 2026-03-01
- Hardened `/boostserver create` ticket panel posting: dropdown options are now explicitly fixed to exactly `Boost Request` and `Questions`
- Maintains non-blocking 2.5s delay, read-only `【🚀】・booster-tickets`, duplicate prevention, and panel message ID persistence

## v2.8.1 — 2026-03-01
- Updated wizard-based `/boostserver create` execution rules: creates only selected channels, keeps tickets category private, and applies public visibility via main category + selected public channels (view-only for `@everyone`)
- Announcements header embed now always includes wizard description and owner mention
- Persisted ticket setup metadata from creation: ticket ping mode plus explicit `logs_to_mod_chat` flag
- Added DB migration support for `boost_server_ticket_config.logs_to_mod_chat`

## v2.8.0 — 2026-03-01
- `/boostserver create` now starts a 5-step interactive setup wizard instead of creating channels immediately
- Added modal + select-menu + button flow (with 5-minute expiry and one active wizard per user per guild)
- Required channels (`announcements`, `chat`, `mod-chat`) are always included; optional channel creation and public visibility are configured before creation
- Ticket ping mode and "send logs to mod-chat" choices are collected before confirmation and applied on creation
- Creation only runs after **Confirm**; **Cancel** aborts wizard

## v2.7.11 — 2026-03-01
- Improved robustness for ticket panel creation in `/boostserver create`: panel-post failures are now clearly logged as **non-fatal** and do not fail server creation
- `/boostserver ticket-setup` now explicitly auto-recreates the panel message when none is found in `【🚀】・booster-tickets`, then persists the new `panel_message_id`

## v2.7.10 — 2026-03-01
- `/boostserver create` now auto-posts a default ticket panel embed + dropdown in `【🚀】・booster-tickets` after a safe non-blocking 2.5s delay
- Prevents duplicate panels by reusing existing bot panel message (stored ID, pinned search, then recent search fallback)
- Stores ticket panel message ID in DB (`boost_server_ticket_config.panel_message_id`) and reuses it in `/boostserver ticket-setup`
- Added migration support for `panel_message_id` in `boost_server_ticket_config`

## v2.7.9 — 2026-03-01
- `/boostserver ticket-setup` now strictly resolves categories as: trimmed, case-insensitive deduplicated, max 6, and stored as final resolved array
- Fallback defaults are always exactly: `Boost Request`, `Questions` when input is missing/blank/invalid or resolves to fewer than 2 categories
- Ticket panel dropdown is guaranteed to render with at least 2 options (zero-category panels are blocked)

## v2.7.8 — 2026-03-01
- **Bugfix**: `createBoostServer()` INSERT was missing `tickets_category_id` and `channel_ticket_panel_id` columns — both were silently discarded, causing `/boostserver ticket-setup` to always fail for newly created servers
- **Bugfix**: `/boostserver ticket-setup` now auto-discovers the panel channel via 3-tier fallback (stored ID → tickets category children → category name pattern) and persists discovered IDs back to DB, repairing older servers automatically
- **Feature**: default categories "Boost Request" and "Questions" when none are provided — dropdown is always present
- Panel message is now pinned in the booster-tickets channel

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
