// discord/commands.js — All SlashCommandBuilder definitions (7 consolidated commands)
const { SlashCommandBuilder, ChannelType } = require("discord.js");

function getCommands() {
  return [
    // ── /timer (consolidates settime, addtime, removetime, cleartime, pausetime, resumetime, showtime) ──
    new SlashCommandBuilder()
      .setName("timer")
      .setDescription("Manage timed roles for users.")
      .addSubcommand((s) =>
        s
          .setName("set")
          .setDescription("Set a user's timed role time to exactly N minutes from now and assign the role.")
          .addUserOption((o) => o.setName("user").setDescription("User to set time for").setRequired(true))
          .addStringOption((o) =>
            o.setName("time").setDescription("Duration: 1d, 24h, 1440m, 1440, or 1d 12h 30m").setRequired(true)
          )
          .addStringOption((o) =>
            o
              .setName("role")
              .setDescription("Role to grant (must be configured via /setup timer-roles)")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addChannelOption((o) =>
            o
              .setName("channel")
              .setDescription("Where expiry warnings should be sent (optional). If omitted, warnings are DMed.")
              .setRequired(false)
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("add")
          .setDescription("Add minutes to a user's timed role and assign the role.")
          .addUserOption((o) => o.setName("user").setDescription("User to add time to").setRequired(true))
          .addStringOption((o) =>
            o.setName("time").setDescription("Duration: 1d, 24h, 1440m, 1440, or 1d 12h 30m").setRequired(true)
          )
          .addStringOption((o) =>
            o
              .setName("role")
              .setDescription("Role to add time to (must be configured via /setup timer-roles)")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("remove")
          .setDescription("Remove minutes from a user's timed role.")
          .addUserOption((o) => o.setName("user").setDescription("User to modify").setRequired(true))
          .addStringOption((o) =>
            o.setName("time").setDescription("Duration: 1d, 24h, 1440m, 1440, or 1d 12h 30m").setRequired(true)
          )
          .addStringOption((o) =>
            o
              .setName("role")
              .setDescription("Role to remove time from (must be configured via /setup timer-roles)")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("clear")
          .setDescription("Clear a user's timed role timer and remove the role.")
          .addUserOption((o) => o.setName("user").setDescription("User to clear").setRequired(true))
          .addStringOption((o) =>
            o
              .setName("role")
              .setDescription("Role to clear (optional, must be configured via /setup timer-roles)")
              .setRequired(false)
              .setAutocomplete(true)
          )
      )
      .addSubcommandGroup((g) =>
        g
          .setName("pause")
          .setDescription("Pause timed role timers")
          .addSubcommand((s) =>
            s
              .setName("global")
              .setDescription("Pause ALL timers in the guild")
              .addIntegerOption((o) => o.setName("duration").setDescription("Pause duration in minutes (required)").setRequired(true).setMinValue(1).setMaxValue(1440))
              .addRoleOption((o) => o.setName("role").setDescription("Specific role to pause (optional, pauses all if omitted)").setRequired(false))
          )
          .addSubcommand((s) =>
            s
              .setName("user")
              .setDescription("Pause a specific user's timed role timer")
              .addUserOption((o) => o.setName("member").setDescription("User to pause").setRequired(true))
              .addStringOption((o) => o.setName("duration").setDescription("Pause duration (1d, 24h, 1440m, 1440, or 1d 12h)").setRequired(true))
              .addRoleOption((o) => o.setName("role").setDescription("Specific role to pause (optional, pauses all if omitted)").setRequired(false))
              .addBooleanOption((o) => o.setName("remove").setDescription("Remove/override pause (admin only, bypasses credits)").setRequired(false))
          )
          .addSubcommand((s) =>
            s
              .setName("credit")
              .setDescription("Manage pause credits (Admin only)")
              .addUserOption((o) => o.setName("user").setDescription("User to manage credits for").setRequired(true))
              .addStringOption((o) =>
                o
                  .setName("action")
                  .setDescription("Add or remove pause credits")
                  .setRequired(true)
                  .addChoices(
                    { name: "Add", value: "add" },
                    { name: "Remove", value: "remove" }
                  )
              )
              .addIntegerOption((o) => o.setName("amount").setDescription("Number of minutes to add/remove").setRequired(true).setMinValue(1))
          )
      )
      .addSubcommandGroup((g) =>
        g
          .setName("resume")
          .setDescription("Resume paused timed role timers")
          .addSubcommand((s) =>
            s
              .setName("global")
              .setDescription("Resume ALL timers that were paused globally")
              .addRoleOption((o) => o.setName("role").setDescription("Specific role to resume (optional, resumes all if omitted)").setRequired(false))
          )
          .addSubcommand((s) =>
            s
              .setName("user")
              .setDescription("Resume a specific user's paused timed role timer")
              .addUserOption((o) => o.setName("user").setDescription("User to resume").setRequired(true))
              .addRoleOption((o) => o.setName("role").setDescription("Specific role to resume (optional, resumes all if omitted)").setRequired(false))
          )
      )
      .addSubcommand((s) =>
        s
          .setName("show")
          .setDescription("Show remaining timed role time for a user (and optional role).")
          .addUserOption((o) => o.setName("user").setDescription("User to check (default: you)").setRequired(false))
          .addStringOption((o) =>
            o
              .setName("role")
              .setDescription("Role to check (optional, must be configured via /setup timer-roles)")
              .setRequired(false)
              .setAutocomplete(true)
          )
      )
      .addSubcommandGroup((g) =>
        g
          .setName("schedule")
          .setDescription("Manage automated timer reports posted to a channel")
          .addSubcommand((s) =>
            s
              .setName("set")
              .setDescription("Create or update an automated timer report for a role")
              .addRoleOption((o) => o.setName("role").setDescription("Role to monitor").setRequired(true))
              .addChannelOption((o) =>
                o
                  .setName("channel")
                  .setDescription("Channel to post reports (required when enabling)")
                  .setRequired(false)
                  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              )
              .addIntegerOption((o) =>
                o
                  .setName("interval")
                  .setDescription("Minutes between reports (required when enabling)")
                  .setRequired(false)
                  .setMinValue(1)
              )
              .addIntegerOption((o) =>
                o
                  .setName("purge")
                  .setDescription("Lines to purge before posting (0-100, optional)")
                  .setRequired(false)
                  .setMinValue(0)
                  .setMaxValue(100)
              )
              .addStringOption((o) =>
                o
                  .setName("enabled")
                  .setDescription("Turn the schedule on or off (default: on)")
                  .setRequired(false)
                  .addChoices(
                    { name: "On", value: "on" },
                    { name: "Off", value: "off" }
                  )
              )
          )
          .addSubcommand((s) =>
            s
              .setName("list")
              .setDescription("Show all active automated timer reports in this server")
          )
      ),

    // ── /autopurge (unchanged) ──
    new SlashCommandBuilder()
      .setName("autopurge")
      .setDescription("Automatically purge bot or user messages from a channel at set intervals.")
      .addSubcommand((s) =>
        s
          .setName("set")
          .setDescription("Set up auto-purge for a channel")
          .addChannelOption((o) => o.setName("channel").setDescription("Channel to auto-purge").setRequired(true))
          .addStringOption((o) =>
            o
              .setName("type")
              .setDescription("Message type to purge")
              .setRequired(true)
              .addChoices(
                { name: "Bot messages only", value: "bot" },
                { name: "User messages only", value: "user" },
                { name: "Both bot and user messages", value: "both" }
              )
          )
          .addIntegerOption((o) =>
            o
              .setName("lines")
              .setDescription("Number of messages to purge per interval (1-100)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(100)
          )
          .addIntegerOption((o) =>
            o
              .setName("interval")
              .setDescription("Minutes between purges (15-10080)")
              .setRequired(true)
              .setMinValue(15)
              .setMaxValue(10080)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("disable")
          .setDescription("Disable auto-purge for a channel")
          .addChannelOption((o) => o.setName("channel").setDescription("Channel to disable").setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName("status")
          .setDescription("Show all auto-purge settings in this server")
      ),

    // ── /setup (reports, streak-roles, streak-leaderboard-size — dashboard access removed) ──
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Configure server settings for BoostMon.")
      .addSubcommand((s) =>
        s
          .setName("reports")
          .setDescription("Configure leaderboard report settings for this server")
          .addStringOption((o) =>
            o
              .setName("filter")
              .setDescription("Sort order for leaderboard reports")
              .setRequired(true)
              .addChoices(
                { name: "🔼 Ascending (expires soonest first)", value: "ascending" },
                { name: "🔽 Descending (expires latest first)", value: "descending" }
              )
          )
      )
      .addSubcommand((s) =>
        s
          .setName("streak-roles")
          .setDescription("Configure roles for streak thresholds")
          .addIntegerOption((o) =>
            o.setName("days")
              .setDescription("Day threshold for the role (e.g., 3, 7, 14, 30, 60, 90)")
              .setRequired(true)
              .setMinValue(1)
          )
          .addRoleOption((o) =>
            o.setName("role")
              .setDescription("Role to assign at this threshold")
              .setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("action")
              .setDescription("Add or remove this threshold")
              .setRequired(false)
              .addChoices(
                { name: "Add/Update", value: "add" },
                { name: "Remove", value: "remove" }
              )
          )
      )
      .addSubcommand((s) =>
        s
          .setName("streak-leaderboard-size")
          .setDescription("Set how many members to show on the streak leaderboard")
          .addIntegerOption((o) =>
            o.setName("size")
              .setDescription("Number of members to display (1-50)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(50)
          )
      )
      .addSubcommand((s) => {
        const cmd = s
          .setName("timer-roles")
          .setDescription("Configure allowed timer roles");
        
        // Add 25 role options
        for (let i = 1; i <= 25; i++) {
          cmd.addRoleOption((o) =>
            o
              .setName(`role_${i}`)
              .setDescription(`Role #${i} (optional)`)
              .setRequired(false)
          );
        }
        return cmd;
      })
      // ── boostserver subcommand group ──
      .addSubcommandGroup((g) =>
        g
          .setName("boostserver")
          .setDescription("Manage Roblox Boost Servers")
          .addSubcommand((s) =>
            s
              .setName("create")
              .setDescription("Create a new boost server")
              .addUserOption((o) =>
                o.setName("owner").setDescription("User who will own this boost server").setRequired(true)
              )
              .addStringOption((o) =>
                o.setName("name").setDescription("Server name (auto-increments if not provided)").setRequired(false)
              )
              .addStringOption((o) =>
                o.setName("game_name").setDescription("Game name for this server").setRequired(false)
              )
              .addIntegerOption((o) =>
                o.setName("max_players").setDescription("Max player slots (default: 24)").setRequired(false).setMinValue(1).setMaxValue(100)
              )
              .addNumberOption((o) =>
                o.setName("boost_rate").setDescription("Boost rate multiplier (default: 1.5)").setRequired(false).setMinValue(0.1).setMaxValue(100)
              )
              .addIntegerOption((o) =>
                o.setName("duration_minutes").setDescription("Boost duration in minutes (default: 60)").setRequired(false).setMinValue(1).setMaxValue(10080)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("info")
              .setDescription("View details about a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("owner-set")
              .setDescription("Set the owner of a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addUserOption((o) =>
                o.setName("user").setDescription("User to set as owner").setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("owner-view")
              .setDescription("View the owner of a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("mods-add")
              .setDescription("Add a moderator to a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addUserOption((o) =>
                o.setName("user").setDescription("User to add as moderator").setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("mods-remove")
              .setDescription("Remove a moderator from a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addUserOption((o) =>
                o.setName("user").setDescription("Moderator to remove").setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("mods-list")
              .setDescription("List all moderators of a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("link-set")
              .setDescription("Set the Roblox link for a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addStringOption((o) =>
                o.setName("link").setDescription("Roblox server link or URL").setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("link-view")
              .setDescription("View the link for a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("link-clear")
              .setDescription("Clear the link for a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("status-set")
              .setDescription("Set the status of a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addStringOption((o) =>
                o
                  .setName("status")
                  .setDescription("New status for the server")
                  .setRequired(true)
                  .addChoices(
                    { name: "Active", value: "active" },
                    { name: "Inactive", value: "inactive" },
                    { name: "Maintenance", value: "maintenance" },
                    { name: "Full", value: "full" }
                  )
              )
          )
          .addSubcommand((s) =>
            s
              .setName("config-set")
              .setDescription("Set a configuration value for a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addStringOption((o) =>
                o
                  .setName("key")
                  .setDescription("Configuration key to set")
                  .setRequired(true)
                  .addChoices(
                    { name: "Max Slots", value: "max_slots" },
                    { name: "Description", value: "description" },
                    { name: "Game ID", value: "game_id" },
                    { name: "Auto Restart", value: "auto_restart" }
                  )
              )
              .addStringOption((o) =>
                o.setName("value").setDescription("Value to set for the config key").setRequired(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("archive")
              .setDescription("Archive a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
          )
          .addSubcommand((s) =>
            s
              .setName("delete")
              .setDescription("Permanently delete a boost server")
              .addStringOption((o) =>
                o.setName("server").setDescription("Select a boost server").setRequired(true).setAutocomplete(true)
              )
              .addBooleanOption((o) =>
                o.setName("confirm").setDescription("Confirm deletion (must be true)").setRequired(true)
              )
          )
      ),

    // ── /streak (status, leaderboard, admin grant-save/remove-save/set — list-size moved to /setup) ──
    new SlashCommandBuilder()
      .setName("streak")
      .setDescription("View or manage boost streaks")
      .addSubcommand((s) =>
        s.setName("status")
          .setDescription("View your current streak status or another user's")
          .addUserOption((o) => o.setName("user").setDescription("User to check (default: you)").setRequired(false))
      )
      .addSubcommand((s) =>
        s.setName("leaderboard")
          .setDescription("View the longest boost streaks in the server")
      )
      .addSubcommandGroup((g) =>
        g.setName("admin")
          .setDescription("Admin streak management")
          .addSubcommand((s) =>
            s.setName("grant-save")
              .setDescription("Grant a streak save token to a user")
              .addUserOption((o) => o.setName("user").setDescription("User to grant save to").setRequired(true))
              .addIntegerOption((o) => o.setName("amount").setDescription("Number of saves (default: 1)").setRequired(false).setMinValue(1))
          )
          .addSubcommand((s) =>
            s.setName("remove-save")
              .setDescription("Remove a streak save token from a user")
              .addUserOption((o) => o.setName("user").setDescription("User to remove save from").setRequired(true))
              .addIntegerOption((o) => o.setName("amount").setDescription("Number of saves (default: 1)").setRequired(false).setMinValue(1))
          )
          .addSubcommand((s) =>
            s.setName("set")
              .setDescription("Set a user's streak to a specific number of days")
              .addUserOption((o) => o.setName("user").setDescription("User to set streak for").setRequired(true))
              .addIntegerOption((o) => o.setName("days").setDescription("Number of streak days to set").setRequired(true).setMinValue(0))
          )
      ),

    // ── /queue (renamed from /boostqueue, complete removed) ──
    new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Manage the boost queue for users waiting for boosts.")
      .addSubcommand((s) =>
        s
          .setName("add")
          .setDescription("Add yourself (or another user) to the boost queue")
          .addUserOption((o) =>
            o.setName("user").setDescription("User to add (admin only, defaults to you)").setRequired(false)
          )
          .addStringOption((o) =>
            o.setName("note").setDescription("Optional note or reason (max 255 chars)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("remove")
          .setDescription("Remove yourself (or another user) from the queue")
          .addUserOption((o) =>
            o.setName("user").setDescription("User to remove (admin only, defaults to you)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("status")
          .setDescription("Check your (or another user's) position in the boost queue")
          .addUserOption((o) =>
            o.setName("user").setDescription("User to check (default: you)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("list")
          .setDescription("View the entire boost queue (auto-removes members who left the server)")
          .addChannelOption((o) =>
            o.setName("channel")
              .setDescription("Post the queue publicly in this channel (admin only)")
              .setRequired(false)
          )
      ),

    // ── /register (merged: flat command with optional user param) ──
    new SlashCommandBuilder()
      .setName("register")
      .setDescription("Register yourself (or another user) with in-game info")
      .addStringOption((o) =>
        o.setName("username").setDescription("In-game username").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("display").setDescription("Display name").setRequired(true)
      )
      .addUserOption((o) =>
        o.setName("user").setDescription("User to register (admin only, defaults to yourself)").setRequired(false)
      ),

    // ── /url (Server URL Management) ──
    new SlashCommandBuilder()
      .setName("url")
      .setDescription("Manage role-based server URLs")
      .addSubcommand((s) =>
        s
          .setName("put")
          .setDescription("Set a server URL for a specific role (Admin only)")
          .addStringOption((o) => o.setName("url").setDescription("The URL to store").setRequired(true))
          .addRoleOption((o) => o.setName("role").setDescription("The role to assign this URL to").setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName("get")
          .setDescription("Get server URLs for your roles")
      ),

    // ── /info (Show user stats) ──
    new SlashCommandBuilder()
      .setName("info")
      .setDescription("View your stats (streak, timer, pause credits, etc)")
      .addUserOption((o) =>
        o.setName("user").setDescription("User to check (default: you)").setRequired(false)
      ),
  ];
}

module.exports = { getCommands };
