// discord/handlers/timer.js — /timer command handler (routes subcommands to existing handlers)
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const handleSettime = require("./settime");
const handleAddtime = require("./addtime");
const handleRemovetime = require("./removetime");
const handleCleartime = require("./cleartime");
const handlePausetime = require("./pausetime");
const handleResumetime = require("./resumetime");
const handleShowtime = require("./showtime");
const db = require("../../db");
const { BOOSTMON_ICON_URL } = require("../../utils/helpers");

const subcommandMap = {
  set:    handleSettime,
  add:    handleAddtime,
  remove: handleRemovetime,
  clear:  handleCleartime,
  show:   handleShowtime,
};

const subcommandGroupMap = {
  pause:  handlePausetime,
  resume: handleResumetime,
};

// Helper: Check if user is admin or server owner
function isAdminOrOwner(interaction) {
  return (
    interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
    interaction.guild.ownerId === interaction.user.id
  );
}

module.exports = async function handleTimer(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const group = interaction.options.getSubcommandGroup(false);

  // ── /timer schedule set|list ──
  if (group === "schedule") {
    await interaction.deferReply().catch(() => null);

    if (!interaction.guild) {
      return interaction.editReply({ content: "This command can only be used in a server." });
    }

    const guild = interaction.guild;

    // --- /timer schedule set|list: Admin and owner only ---
    if (subcommand === "set" || subcommand === "list") {
      if (!isAdminOrOwner(interaction)) {
        return interaction.editReply({
          content: "❌ Only administrators and server owner can manage timer schedules.",
        });
      }
    }

    // --- /timer schedule set ---
    if (subcommand === "set") {

      const role = interaction.options.getRole("role", true);
      const enabled = interaction.options.getString("enabled") || "on";

      // --- Disable mode ---
      if (enabled === "off") {
        const success = await db.disableRolestatusSchedule(guild.id, role.id);

        if (!success) {
          return interaction.editReply({
            content: `No active schedules found for **${role.name}**.`,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
          .setTitle("⛔ Schedule Disabled")
          .setTimestamp(new Date())
          .addFields(
            { name: "Role", value: `${role.name}`, inline: true },
            { name: "Status", value: "🔴 Inactive - Reports stopped", inline: true }
          )
          .setFooter({ text: "BoostMon • Scheduled Report Stopped" });

        return interaction.editReply({ embeds: [embed] });
      }

      // --- Enable mode — channel and interval are required ---
      const channel = interaction.options.getChannel("channel");
      const interval = interaction.options.getInteger("interval");
      const purgeLines = interaction.options.getInteger("purge") || 0;

      if (!channel || !interval) {
        return interaction.editReply({
          content: "To enable a schedule, you must provide both **channel** and **interval**.",
        });
      }

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return interaction.editReply({
          content: "Channel must be a text or announcement channel.",
        });
      }

      const me = await guild.members.fetchMe();
      const perms = channel.permissionsFor(me);

      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply({
          content: `I don't have permission to send messages in ${channel}.`,
        });
      }

      if (purgeLines > 0 && !perms?.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({
          content: `I don't have permission to manage messages in ${channel}. Purge feature requires this permission.`,
        });
      }

      const schedule = await db.createRolestatusSchedule(guild.id, role.id, channel.id, interval, purgeLines);

      if (!schedule) {
        return interaction.editReply({
          content: "Failed to create schedule. Please try again.",
        });
      }

      const purgeDescription = purgeLines === 0
        ? "🟢 Disabled - all messages will be kept"
        : `🗑️ Will delete ${purgeLines} message(s) before each report`;

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("✅ Schedule Created")
        .setTimestamp(new Date())
        .addFields(
          { name: "Role", value: `${role.name}`, inline: true },
          { name: "Channel", value: `${channel.name}`, inline: true },
          { name: "Interval", value: `Every ${interval} minutes`, inline: true },
          { name: "Purge Configuration", value: purgeDescription, inline: false },
          { name: "Status", value: "🟢 Active - Reports will begin shortly", inline: false }
        )
        .setFooter({ text: "BoostMon • Scheduled Report Started" });

      return interaction.editReply({ embeds: [embed] });
    }

    // --- /timer schedule list ---
    if (subcommand === "list") {
      const schedules = await db.getAllRolestatusSchedules(guild.id);

      if (schedules.length === 0) {
        return interaction.editReply({
          content: "No active timer schedules in this server.",
        });
      }

      const fields = [];
      for (const schedule of schedules) {
        try {
          const role = await guild.roles.fetch(schedule.role_id).catch(() => null);
          const channel = await guild.channels.fetch(schedule.channel_id).catch(() => null);

          if (role && channel) {
            fields.push({
              name: `${role.name}`,
              value: `📢 Posts to ${channel.name}\n⏱️ Every ${schedule.interval_minutes} min`,
              inline: false,
            });
          }
        } catch (err) {
          console.error("Error fetching schedule details:", err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("📋 Active Timer Schedules")
        .setTimestamp(new Date())
        .addFields(...fields)
        .setFooter({ text: `BoostMon • ${schedules.length} schedule(s) active` });

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply({ content: `Unknown schedule subcommand: ${subcommand}` });
  }

  // ── Subcommand groups (pause, resume) ──
  if (group) {
    // Permission checks for subcommand groups
    if (group === "pause") {
      const pauseSubcommand = subcommand;
      
      // /timer pause credit: admin and owner only
      if (pauseSubcommand === "credit") {
        if (!isAdminOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ Only administrators and server owner can manage pause credits.",
            ephemeral: true,
          });
        }
      }
      
      // /timer pause global: admin and owner only
      if (pauseSubcommand === "global") {
        if (!isAdminOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ Only administrators and server owner can pause global timers.",
            ephemeral: true,
          });
        }
      }
      
      // /timer pause user: anyone (they spend their own credits)
    }

    if (group === "resume") {
      const resumeSubcommand = subcommand;
      
      // /timer resume global: admin and owner only
      if (resumeSubcommand === "global") {
        if (!isAdminOrOwner(interaction)) {
          return interaction.reply({
            content: "❌ Only administrators and server owner can resume global timers.",
            ephemeral: true,
          });
        }
      }
      
      // /timer resume user: check if they're resuming their own timer
      if (resumeSubcommand === "user") {
        const targetUser = interaction.options.getUser("user", true);
        
        // Users can only resume their own timers (unless admin/owner)
        if (targetUser.id !== interaction.user.id && !isAdminOrOwner(interaction)) {
          return interaction.reply({
            content: `❌ You can only resume your own timers. Contact an admin to resume <@${targetUser.id}>'s timers.`,
            ephemeral: true,
          });
        }
      }
    }

    const groupHandler = subcommandGroupMap[group];
    if (!groupHandler) {
      return interaction.reply({ content: `Unknown timer subcommand group: ${group}`, ephemeral: true });
    }
    return groupHandler(interaction);
  }

  // ── Direct subcommands (set, add, remove, clear, show) ──
  const handler = subcommandMap[subcommand];

  if (!handler) {
    return interaction.reply({ content: `Unknown timer subcommand: ${subcommand}`, ephemeral: true });
  }

  // Permission checks for direct subcommands
  // /timer set: admin and owner only
  if (subcommand === "set") {
    if (!isAdminOrOwner(interaction)) {
      return interaction.reply({
        content: "❌ Only administrators and server owner can set timers.",
        ephemeral: true,
      });
    }
  }

  // /timer add: admin and owner only
  if (subcommand === "add") {
    if (!isAdminOrOwner(interaction)) {
      return interaction.reply({
        content: "❌ Only administrators and server owner can add timer time.",
        ephemeral: true,
      });
    }
  }

  // /timer remove: admin and owner only
  if (subcommand === "remove") {
    if (!isAdminOrOwner(interaction)) {
      return interaction.reply({
        content: "❌ Only administrators and server owner can remove timer time.",
        ephemeral: true,
      });
    }
  }

  // /timer clear: admin and owner only
  if (subcommand === "clear") {
    if (!isAdminOrOwner(interaction)) {
      return interaction.reply({
        content: "❌ Only administrators and server owner can clear timers.",
        ephemeral: true,
      });
    }
  }

  // /timer show: anyone can use

  return handler(interaction);
};
