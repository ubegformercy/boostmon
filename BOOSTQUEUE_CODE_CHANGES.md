# 📝 Boost Queue - Code Changes Summary

## Files Modified

1. **`/workspaces/nodejs/db.js`** - Database layer
2. **`/workspaces/nodejs/app.js`** - Discord bot commands and handlers

---

## 1. Database Changes (`db.js`)

### A. New Table Creation (in `initDatabase()`)

**Location:** After `dashboard_access` table creation

```javascript
await client.query(`
  CREATE TABLE IF NOT EXISTS boost_queue (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    completed_by VARCHAR(255),
    completed_at TIMESTAMP,
    position_order INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id)
  );
`);
```

### B. New Indexes (in `initDatabase()`)

**Location:** In the `indexes` array

```javascript
'CREATE INDEX IF NOT EXISTS idx_boost_queue_guild_id ON boost_queue(guild_id)',
'CREATE INDEX IF NOT EXISTS idx_boost_queue_user_id ON boost_queue(guild_id, user_id)',
'CREATE INDEX IF NOT EXISTS idx_boost_queue_position ON boost_queue(guild_id, position_order)',
'CREATE INDEX IF NOT EXISTS idx_boost_queue_status ON boost_queue(guild_id, status)',
```

### C. New Database Methods

**Location:** After `isRestrictModeActive()` function, before `closePool()`

```javascript
// ===== BOOST QUEUE OPERATIONS =====

async function addToQueue(userId, guildId, note = null) {
  try {
    // Get the next position (max position + 1, or 1 if queue is empty)
    const maxResult = await pool.query(
      `SELECT MAX(position_order) as max_position FROM boost_queue WHERE guild_id = $1 AND status = 'pending'`,
      [guildId]
    );
    const nextPosition = (maxResult.rows[0]?.max_position || 0) + 1;

    const result = await pool.query(
      `INSERT INTO boost_queue (guild_id, user_id, note, status, position_order)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         status = 'pending',
         note = $3,
         position_order = $4,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [guildId, userId, note, nextPosition]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error("addToQueue error:", err);
    return null;
  }
}

async function removeFromQueue(userId, guildId) {
  try {
    const result = await pool.query(
      `DELETE FROM boost_queue WHERE guild_id = $1 AND user_id = $2 RETURNING *`,
      [guildId, userId]
    );
    
    // Reorder remaining positions
    if (result.rows.length > 0) {
      await pool.query(
        `UPDATE boost_queue 
         SET position_order = ROW_NUMBER() OVER (ORDER BY position_order)
         WHERE guild_id = $1 AND status = 'pending'`,
        [guildId]
      );
    }
    
    return result.rows.length > 0;
  } catch (err) {
    console.error("removeFromQueue error:", err);
    return false;
  }
}

async function getQueue(guildId, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT * FROM boost_queue 
       WHERE guild_id = $1 AND status = 'pending'
       ORDER BY position_order ASC
       LIMIT $2`,
      [guildId, limit]
    );
    return result.rows;
  } catch (err) {
    console.error("getQueue error:", err);
    return [];
  }
}

async function getUserQueuePosition(userId, guildId) {
  try {
    const result = await pool.query(
      `SELECT position_order FROM boost_queue 
       WHERE guild_id = $1 AND user_id = $2 AND status = 'pending'`,
      [guildId, userId]
    );
    return result.rows[0]?.position_order || null;
  } catch (err) {
    console.error("getUserQueuePosition error:", err);
    return null;
  }
}

async function completeQueue(userId, guildId, adminId = null) {
  try {
    const result = await pool.query(
      `UPDATE boost_queue 
       SET status = 'completed', completed_by = $3, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE guild_id = $1 AND user_id = $2
       RETURNING *`,
      [guildId, userId, adminId]
    );
    
    // Reorder remaining positions
    if (result.rows.length > 0) {
      await pool.query(
        `UPDATE boost_queue 
         SET position_order = ROW_NUMBER() OVER (ORDER BY position_order)
         WHERE guild_id = $1 AND status = 'pending'`,
        [guildId]
      );
    }
    
    return result.rows[0] || null;
  } catch (err) {
    console.error("completeQueue error:", err);
    return null;
  }
}

async function getQueueUser(userId, guildId) {
  try {
    const result = await pool.query(
      `SELECT * FROM boost_queue WHERE guild_id = $1 AND user_id = $2 AND status = 'pending'`,
      [guildId, userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error("getQueueUser error:", err);
    return null;
  }
}
```

### D. Update Module Exports

**Location:** In `module.exports` section

```javascript
// Boost queue operations
addToQueue,
removeFromQueue,
getQueue,
getUserQueuePosition,
completeQueue,
getQueueUser,
```

---

## 2. App.js Changes

### A. Add Command Definition

**Location:** In the `commands` array, after `setup` command

```javascript
new SlashCommandBuilder()
  .setName("boostqueue")
  .setDescription("Manage the boost queue for users waiting for boosts.")
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Add yourself to the boost queue")
      .addStringOption((o) =>
        o.setName("note").setDescription("Optional note or reason (max 255 chars)").setRequired(false)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Remove yourself or someone else from the queue (admin only for others)")
      .addUserOption((o) =>
        o.setName("user").setDescription("User to remove (optional, defaults to you)").setRequired(false)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("view")
      .setDescription("View the entire boost queue")
  )
  .addSubcommand((s) =>
    s
      .setName("status")
      .setDescription("Check your position in the boost queue")
  )
  .addSubcommand((s) =>
    s
      .setName("complete")
      .setDescription("Mark a user as completed (admin only)")
      .addUserOption((o) =>
        o.setName("user").setDescription("User who received their boost").setRequired(true)
      )
  ),
```

### B. Add Command Handlers

**Location:** In `interactionCreate` event handler, after `setup` command handlers, before the catch block

```javascript
// ---------- /boostqueue ----------
if (interaction.commandName === "boostqueue") {
  // Defer immediately to prevent interaction timeout
  await interaction.deferReply().catch(() => null);

  if (!interaction.guild) {
    return interaction.editReply({ content: "This command can only be used in a server." });
  }

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  // ---------- /boostqueue add ----------
  if (subcommand === "add") {
    const note = interaction.options.getString("note");
    const userId = interaction.user.id;

    // Check if user is already in queue
    const existingInQueue = await db.getQueueUser(userId, guild.id);
    if (existingInQueue) {
      const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("⚠️ Already in Queue")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: `You are already in position **#${existingInQueue.position_order}**`, inline: true }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const queueEntry = await db.addToQueue(userId, guild.id, note);
    if (!queueEntry) {
      return interaction.editReply({ content: "❌ Failed to add you to the queue. Please try again." });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Added to Boost Queue")
      .setTimestamp(new Date())
      .addFields(
        { name: "Your Position", value: `#${queueEntry.position_order}`, inline: true },
        { name: "Added At", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      );

    if (note) {
      embed.addFields({ name: "Your Note", value: note, inline: false });
    }

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue remove ----------
  if (subcommand === "remove") {
    const userOption = interaction.options.getUser("user");
    let targetId = userOption?.id || interaction.user.id;

    // Only allow removing others if user is admin
    if (userOption && userOption.id !== interaction.user.id) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: "⛔ Only **Server Owner** or users with **Administrator** permission can remove others from the queue.",
          ephemeral: true
        });
      }
    }

    const queueEntry = await db.getQueueUser(targetId, guild.id);
    if (!queueEntry) {
      const targetMention = userOption ? `<@${userOption.id}>` : "You are";
      return interaction.editReply({
        content: `${targetMention} not in the queue.`
      });
    }

    const removed = await db.removeFromQueue(targetId, guild.id);
    if (!removed) {
      return interaction.editReply({ content: "❌ Failed to remove from queue. Please try again." });
    }

    const userMention = userOption ? `<@${userOption.id}>` : "You have been";
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("❌ Removed from Queue")
      .setTimestamp(new Date())
      .addFields(
        { name: "Status", value: `${userMention} removed from the boost queue.`, inline: false }
      )
      .setFooter({ text: "BoostMon • Boost Queue" });

    if (userOption && userOption.id !== interaction.user.id) {
      embed.addFields(
        { name: "Removed By", value: `${interaction.user}`, inline: true }
      );
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue view ----------
  if (subcommand === "view") {
    const queue = await db.getQueue(guild.id, 50);
    
    if (queue.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Boost Queue")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: "The boost queue is empty.", inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const fields = [];
    for (const entry of queue) {
      const user = await client.users.fetch(entry.user_id).catch(() => null);
      const userName = user ? user.username : `<@${entry.user_id}>`;
      const noteText = entry.note ? ` • ${entry.note}` : "";
      const addedAt = new Date(entry.added_at).toLocaleString();

      fields.push({
        name: `#${entry.position_order} - ${userName}`,
        value: `Added: ${addedAt}${noteText}`,
        inline: false
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🎯 Boost Queue")
      .setTimestamp(new Date())
      .addFields(...fields)
      .addFields(
        { name: "Total in Queue", value: `${queue.length}`, inline: true }
      )
      .setFooter({ text: "BoostMon • Boost Queue" });

    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue status ----------
  if (subcommand === "status") {
    const position = await db.getUserQueuePosition(interaction.user.id, guild.id);
    
    if (position === null) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
        .setTitle("Your Queue Status")
        .setTimestamp(new Date())
        .addFields(
          { name: "Status", value: "You are **not** in the boost queue.", inline: false }
        )
        .setFooter({ text: "BoostMon • Boost Queue" });
      return interaction.editReply({ embeds: [embed] });
    }

    const queueEntry = await db.getQueueUser(interaction.user.id, guild.id);
    const totalInQueue = (await db.getQueue(guild.id)).length;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("🎯 Your Queue Status")
      .setTimestamp(new Date())
      .addFields(
        { name: "Your Position", value: `#${position} of ${totalInQueue}`, inline: true },
        { name: "People Ahead", value: `${position - 1}`, inline: true }
      );

    if (queueEntry.note) {
      embed.addFields({ name: "Your Note", value: queueEntry.note, inline: false });
    }

    embed.addFields(
      { name: "Added At", value: `<t:${Math.floor(new Date(queueEntry.added_at).getTime() / 1000)}:R>`, inline: true }
    );

    embed.setFooter({ text: "BoostMon • Boost Queue" });
    return interaction.editReply({ embeds: [embed] });
  }

  // ---------- /boostqueue complete ----------
  if (subcommand === "complete") {
    // Only allow admins to mark as complete
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({
        content: "⛔ Only **Server Owner** or users with **Administrator** permission can mark users as completed.",
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const queueEntry = await db.getQueueUser(targetUser.id, guild.id);

    if (!queueEntry) {
      return interaction.editReply({
        content: `<@${targetUser.id}> is not in the queue.`
      });
    }

    const completed = await db.completeQueue(targetUser.id, guild.id, interaction.user.id);
    if (!completed) {
      return interaction.editReply({ content: "❌ Failed to mark as completed. Please try again." });
    }

    // Get the next person in queue
    const nextInQueue = (await db.getQueue(guild.id, 1))[0];

    const embed = new EmbedBuilder()
      .setColor(0x27AE60)
      .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
      .setTitle("✅ Boost Completed")
      .setTimestamp(new Date())
      .addFields(
        { name: "User", value: `<@${targetUser.id}>`, inline: true },
        { name: "Completed By", value: `${interaction.user}`, inline: true }
      );

    if (nextInQueue) {
      embed.addFields(
        { name: "Next in Queue", value: `<@${nextInQueue.user_id}> (Position #1)`, inline: false }
      );
    } else {
      embed.addFields(
        { name: "Next in Queue", value: "Queue is now empty! 🎉", inline: false }
      );
    }

    const reply = await interaction.editReply({ embeds: [embed] });

    // Try to DM the next person
    if (nextInQueue) {
      try {
        const nextUser = await client.users.fetch(nextInQueue.user_id);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setAuthor({ name: "BoostMon", iconURL: BOOSTMON_ICON_URL })
          .setTitle("🎉 You're Next!")
          .setDescription(`You've been promoted to **#1** in the boost queue for **${guild.name}**!`)
          .setTimestamp(new Date())
          .setFooter({ text: "BoostMon • Boost Queue" });

        await nextUser.send({ embeds: [dmEmbed] }).catch(() => null);
      } catch (err) {
        console.warn(`Failed to DM user ${nextInQueue.user_id}:`, err.message);
      }
    }

    return reply;
  }
}
```

### C. Update /settime Handler

**Location:** In the `/settime` handler, after `await member.roles.add(role.id);`

```javascript
const member = await guild.members.fetch(targetUser.id);

const expiresAt = await setMinutesForRole(targetUser.id, role.id, minutes, warnChannelId, guild.id);
await member.roles.add(role.id);

// Remove from boost queue if they were in it
const wasInQueue = await db.getQueueUser(targetUser.id, guild.id);
if (wasInQueue) {
  await db.removeFromQueue(targetUser.id, guild.id);
}
```

### D. Update /addtime Handler

**Location:** In the `/addtime` handler, after `await member.roles.add(role.id);`

```javascript
const expiresAt = await addMinutesForRole(targetUser.id, role.id, minutes, guild.id);

if (!member.roles.cache.has(role.id)) {
  await member.roles.add(role.id);
}

// Remove from boost queue if they were in it
const wasInQueue = await db.getQueueUser(targetUser.id, guild.id);
if (wasInQueue) {
  await db.removeFromQueue(targetUser.id, guild.id);
}
```

---

## Summary of Changes

| File | Changes | Lines Added |
|------|---------|------------|
| `db.js` | 1 new table, 4 indexes, 6 new methods, exports updated | ~200 |
| `app.js` | 1 new command def, 5 handlers, 2 existing handlers updated | ~400 |
| **Total** | **Non-breaking additions** | **~600** |

---

## Verification

To verify the changes are correct:

```bash
# Check for syntax errors
node -c app.js
node -c db.js

# Start the bot
node app.js

# Check command registration (in Discord)
/boostqueue [TAB] - should show all 5 subcommands
```

---

**Last Updated:** February 7, 2026  
**Status:** Ready for Deployment ✅
