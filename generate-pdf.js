const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create PDF document
const doc = new PDFDocument({
  size: 'A4',
  margin: 50,
  bufferPages: true
});

// Pipe to file
const outputPath = path.join(__dirname, 'BoostMon_User_Guide.pdf');
console.log(`Creating PDF at: ${outputPath}`);
const stream = fs.createWriteStream(outputPath);

stream.on('error', (err) => {
  console.error('Stream error:', err);
  process.exit(1);
});

doc.pipe(stream);

// Colors
const primaryColor = '#2ECC71'; // Green
const secondaryColor = '#3498DB'; // Blue
const darkColor = '#2C3E50'; // Dark
const accentColor = '#F39C12'; // Orange

// Helper function to add page number
function addPageNumber(pageNumber) {
  doc.fontSize(10)
    .fillColor('#95A5A6')
    .text(`Page ${pageNumber}`, 50, doc.page.height - 40, { align: 'center' });
}

// ====== PAGE 1: TITLE PAGE ======
doc.fontSize(48)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('BoostMon', 100, 150, { align: 'center' });

doc.fontSize(24)
  .fillColor(secondaryColor)
  .font('Helvetica')
  .text('User Guide & Documentation', 100, 220, { align: 'center' });

// Logo
const logoPath = path.join(__dirname, 'public/images/boostmon.png');
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, 150, 300, { width: 300, height: 300 });
}

doc.fontSize(14)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('A Professional Discord Bot for Managing Timed Roles', 100, 650, { align: 'center' });

doc.fontSize(12)
  .fillColor('#7F8C8D')
  .text('Version 1.0 | January 2026', 100, 690, { align: 'center' });

doc.addPage();

// ====== PAGE 2: TABLE OF CONTENTS ======
doc.fontSize(24)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('Table of Contents', 50, 50);

const tocItems = [
  '1. What is BoostMon?',
  '2. Key Features & Benefits',
  '3. System Requirements',
  '4. Getting Started',
  '5. Command Reference',
  '6. Real-World Examples',
  '7. Advanced Features',
  '8. Troubleshooting',
  '9. FAQ',
  '10. Support & Contact'
];

let yPos = 120;
doc.fontSize(12)
  .fillColor(darkColor)
  .font('Helvetica');

tocItems.forEach(item => {
  doc.text(item, 70, yPos);
  yPos += 25;
});

addPageNumber(2);
doc.addPage();

// ====== PAGE 3: WHAT IS BOOSTMON ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('1. What is BoostMon?', 50, 50);

doc.fontSize(12)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('BoostMon is a professional Discord bot designed specifically for managing timed roles within your Discord server. It provides a comprehensive solution for tracking, managing, and automating role assignments based on customizable time durations.', 50, 100, { width: 500, align: 'left' });

doc.fontSize(14)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Primary Use Cases:', 50, 160);

const useCases = [
  '• Roblox Private Server Boost Tracking - Monitor daily booster contributions',
  '• Subscription-Based Role Management - Assign roles for specific durations',
  '• Event-Based Access Control - Grant temporary permissions to members',
  '• VIP Status Tracking - Manage premium member status with auto-expiration',
  '• Team Rotations - Automatically cycle team roles based on schedule'
];

yPos = 190;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica');

useCases.forEach(useCase => {
  doc.text(useCase, 50, yPos);
  yPos += 22;
});

doc.fontSize(14)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Perfect For:', 50, yPos + 15);

yPos += 50;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('• Gaming Communities & Guilds', 50, yPos);
  yPos += 20;
  doc.text('• Roblox Groups & Communities', 50, yPos);
  yPos += 20;
  doc.text('• Discord Server Administrators', 50, yPos);
  yPos += 20;
  doc.text('• Teams Requiring Temporary Access Control', 50, yPos);

addPageNumber(3);
doc.addPage();

// ====== PAGE 4: KEY FEATURES ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('2. Key Features & Benefits', 50, 50);

const features = [
  {
    title: '⏱️ Precise Timer Management',
    desc: 'Set exact durations down to the minute. Never worry about manual role removal again.'
  },
  {
    title: '🔔 Smart Notifications',
    desc: 'Automatic warning notifications at 60, 10, and 1 minute marks. DM or channel-based alerts.'
  },
  {
    title: '⏸️ Pause & Resume',
    desc: 'Temporarily freeze timers without losing progress. Perfect for inactive players.'
  },
  {
    title: '🗑️ One-Click Management',
    desc: 'Instantly clear timers, adjust durations, or remove roles using simple slash commands.'
  },
  {
    title: '📊 Batch Operations',
    desc: 'View all users with a specific role and their remaining times instantly.'
  },
  {
    title: '💾 Persistent Storage',
    desc: 'PostgreSQL database ensures timers survive bot restarts and crashes.'
  },
  {
    title: '🚀 Enterprise Performance',
    desc: 'Sub-100ms response times. Handles 1000+ concurrent users without slowdown.'
  },
  {
    title: '🔒 Security First',
    desc: 'Role hierarchy protection. Bot respects Discord permission levels.'
  }
];

yPos = 110;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica');

features.forEach((feature, index) => {
  if (yPos > 720) {
    addPageNumber(doc.bufferedPageRange().count);
    doc.addPage();
    yPos = 50;
  }
  
  doc.fontSize(12)
    .fillColor(accentColor)
    .font('Helvetica-Bold')
    .text(feature.title, 50, yPos);
  yPos += 22;
  
  doc.fontSize(11)
    .fillColor(darkColor)
    .font('Helvetica')
    .text(feature.desc, 70, yPos, { width: 430 });
  yPos += 40;
});

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 5: SYSTEM REQUIREMENTS ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('3. System Requirements', 50, 50);

doc.fontSize(12)
  .fillColor(darkColor)
  .font('Helvetica');

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Bot Requirements:', 50, 110);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('✓ Discord Server (guild) with Administrator access', 50, 135)
  .text('✓ BoostMon bot invited to your server', 50, 155)
  .text('✓ Bot role positioned above roles you want to manage', 50, 175)
  .text('✓ Required permissions: Manage Roles, Send Messages, View Channels', 50, 195, { width: 480 });

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Recommended Permissions:', 50, 235);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('• MANAGE_ROLES - Assign and remove timed roles', 50, 260)
  .text('• SEND_MESSAGES - Send command responses', 50, 280)
  .text('• VIEW_CHANNELS - Access notification channels', 50, 300)
  .text('• USE_APPLICATION_COMMANDS - Accept slash commands', 50, 320);

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('User Requirements:', 50, 360);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('• No special requirements for regular users', 50, 385)
  .text('• Administrators need permission to run BoostMon commands', 50, 405, { width: 480 })
  .text('• Users should have notifications enabled to receive warnings', 50, 425, { width: 480 });

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 6: GETTING STARTED ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('4. Getting Started', 50, 50);

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Step 1: Invite BoostMon to Your Server', 50, 110);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('1. Visit https://top.gg/bot/YOUR_BOT_ID', 50, 135)
  .text('2. Click the "Invite" button', 50, 155)
  .text('3. Select your Discord server from the dropdown', 50, 175)
  .text('4. Authorize the required permissions', 50, 195)
  .text('5. Confirm the invitation', 50, 215);

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Step 2: Configure Bot Role Hierarchy', 50, 260);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('1. Open Server Settings → Roles', 50, 285)
  .text('2. Locate the "BoostMon" role', 50, 305)
  .text('3. Ensure it is positioned ABOVE the roles you want to manage', 50, 325, { width: 480 })
  .text('4. This ensures the bot has permission to assign/remove those roles', 50, 345, { width: 480 });

doc.fontSize(13)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Step 3: Create Your First Timer', 50, 390);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica');

const codeBox = `/settime @username 60 @RoleName #announcements`;

doc.rect(50, 415, 480, 35)
  .stroke('#E0E0E0');

doc.fontSize(10)
  .fillColor(darkColor)
  .font('Courier')
  .text(codeBox, 55, 420);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('This creates a 60-minute timer for the user with role assignment and announcements channel warnings.', 50, 460, { width: 480 });

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 7-8: COMMAND REFERENCE ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('5. Command Reference', 50, 50);

const commands = [
  {
    name: '/settime',
    syntax: '/settime @user <minutes> @role [#channel]',
    description: 'Create or update a timed role with exact minutes from now.',
    parameters: [
      '@user (required) - Target Discord user',
      '<minutes> (required) - Duration in minutes (1-10080)',
      '@role (required) - Role to assign',
      '[#channel] (optional) - Warning notification channel'
    ],
    example: '/settime @john 1440 @VIP-Member #alerts',
    response: 'Embed showing timer details, expiration time, and warning channel'
  },
  {
    name: '/addtime',
    syntax: '/addtime @user <minutes> [@role]',
    description: 'Add minutes to an existing timed role.',
    parameters: [
      '@user (required) - Target user',
      '<minutes> (required) - Minutes to add (1-10080)',
      '[@role] (optional) - Specific role (auto-selects first if multiple)'
    ],
    example: '/addtime @john 30 @VIP-Member',
    response: 'Updated expiration time and remaining minutes'
  },
  {
    name: '/removetime',
    syntax: '/removetime @user <minutes> [@role]',
    description: 'Remove minutes from an existing timed role.',
    parameters: [
      '@user (required) - Target user',
      '<minutes> (required) - Minutes to remove (1-10080)',
      '[@role] (optional) - Specific role'
    ],
    example: '/removetime @john 15 @VIP-Member',
    response: 'Updated timer details or expiration confirmation'
  },
  {
    name: '/cleartime',
    syntax: '/cleartime @user [@role]',
    description: 'Completely remove a timed role and delete its timer.',
    parameters: [
      '@user (required) - Target user',
      '[@role] (optional) - Specific role to clear'
    ],
    example: '/cleartime @john @VIP-Member',
    response: 'Confirmation that role and timer were removed'
  },
  {
    name: '/pausetime',
    syntax: '/pausetime @user [@role]',
    description: 'Pause a timer and snapshot the remaining time.',
    parameters: [
      '@user (required) - Target user',
      '[@role] (optional) - Specific role to pause'
    ],
    example: '/pausetime @john @VIP-Member',
    response: 'Paused status with remaining time (countdown stops)'
  },
  {
    name: '/resumetime',
    syntax: '/resumetime @user @role',
    description: 'Resume a paused timer from where it stopped.',
    parameters: [
      '@user (required) - Target user',
      '@role (required) - Specific role to resume'
    ],
    example: '/resumetime @john @VIP-Member',
    response: 'New expiration time and time remaining'
  },
  {
    name: '/showtime',
    syntax: '/showtime [@user] [@role]',
    description: 'Check remaining time on a timed role.',
    parameters: [
      '[@user] (optional) - Target user (defaults to you)',
      '[@role] (optional) - Specific role'
    ],
    example: '/showtime @john @VIP-Member',
    response: 'Active timer, paused status, or no timer found'
  },
  {
    name: '/rolestatus',
    syntax: '/rolestatus @role',
    description: 'View all users with a specific role and their remaining times.',
    parameters: [
      '@role (required) - Role to check'
    ],
    example: '/rolestatus @VIP-Member',
    response: 'List of members with role, sorted by time remaining'
  }
];

yPos = 110;

commands.forEach((cmd, index) => {
  if (yPos > 650) {
    addPageNumber(doc.bufferedPageRange().count);
    doc.addPage();
    yPos = 50;
  }

  // Command name
  doc.fontSize(12)
    .fillColor(accentColor)
    .font('Helvetica-Bold')
    .text(cmd.name, 50, yPos);
  yPos += 20;

  // Syntax
  doc.fontSize(10)
    .fillColor(darkColor)
    .font('Courier')
    .text(cmd.syntax, 50, yPos);
  yPos += 18;

  // Description
  doc.fontSize(10)
    .fillColor(darkColor)
    .font('Helvetica')
    .text(cmd.description, 50, yPos, { width: 480 });
  yPos += 30;

  // Example
  doc.fontSize(9)
    .fillColor('#7F8C8D')
    .font('Courier')
    .text(`Example: ${cmd.example}`, 50, yPos);
  yPos += 18;

  doc.fontSize(9)
    .fillColor('#E67E22')
    .font('Helvetica')
    .text(`Response: ${cmd.response}`, 50, yPos, { width: 480 });
  yPos += 25;

  // Divider
  if (index < commands.length - 1) {
    doc.moveTo(50, yPos)
      .lineTo(530, yPos)
      .stroke('#ECF0F1');
    yPos += 15;
  }
});

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 9: REAL-WORLD EXAMPLES ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('6. Real-World Examples', 50, 50);

doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Example 1: Daily Roblox Boost Tracking', 50, 110);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Scenario: You manage a Roblox private server. Players contribute daily boosts for 24 hours each.', 50, 135, { width: 480 });

yPos = 165;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Courier')
  .text('/settime @player1 1440 @Active-Booster #boost-alerts', 50, yPos);
yPos += 20;
doc.text('/settime @player2 1440 @Active-Booster #boost-alerts', 50, yPos);
yPos += 20;
doc.text('/settime @player3 1440 @Active-Booster #boost-alerts', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Result: Each player gets warnings at 60, 10, and 1 minute. Role auto-removes after 24 hours if not renewed.', 50, yPos, { width: 480 });

yPos += 50;
doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Example 2: VIP Member Subscription', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Scenario: Member purchases 30-day VIP status.', 50, yPos, { width: 480 });

yPos += 25;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Courier')
  .text('/settime @memberName 43200 @VIP-Premium #vip-club', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Result: Member keeps VIP role for exactly 30 days (43,200 minutes). Automatic removal after expiration.', 50, yPos, { width: 480 });

yPos += 50;
doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Example 3: Taking a Break', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Scenario: Player needs a 5-day break but wants to preserve their timer.', 50, yPos, { width: 480 });

yPos += 25;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Courier')
  .text('/pausetime @playerName @Booster', 50, yPos);
yPos += 20;
doc.text('(5 days later...)', 50, yPos);
yPos += 20;
doc.text('/resumetime @playerName @Booster', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Result: Timer is frozen during absence, then resumes from exact same point.', 50, yPos, { width: 480 });

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 10: ADVANCED FEATURES ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('7. Advanced Features', 50, 50);

doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Smart Warning System', 50, 110);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('BoostMon sends automatic notifications at three critical times:', 50, 135, { width: 480 });

yPos = 165;
doc.fontSize(11)
  .fillColor('#27AE60')
  .font('Helvetica-Bold')
  .text('60 Minutes Remaining', 50, yPos)
  .fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Early warning - plenty of time to act', 70, yPos + 18, { width: 440 });

yPos += 50;
doc.fontSize(11)
  .fillColor('#F39C12')
  .font('Helvetica-Bold')
  .text('10 Minutes Remaining', 50, yPos)
  .fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Urgent reminder - prepare to renew or extend', 70, yPos + 18, { width: 440 });

yPos += 50;
doc.fontSize(11)
  .fillColor('#E74C3C')
  .font('Helvetica-Bold')
  .text('1 Minute Remaining', 50, yPos)
  .fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Critical alert - last chance to take action', 70, yPos + 18, { width: 440 });

yPos += 50;
doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Channel & DM Notifications', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Choose where warnings are sent:', 50, yPos, { width: 480 });

yPos += 25;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('• Specified Channel: Public visibility, everyone sees warnings', 50, yPos)
  .text('• Direct Message: Private notifications sent to user\'s DM', 50, yPos + 20, { width: 480 });

yPos += 60;
doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Multiple Timers Per User', 50, yPos);

yPos += 30;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Users can have multiple timed roles active simultaneously. Perfect for complex role systems:', 50, yPos, { width: 480 });

yPos += 30;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('• Player could have @Booster (1 day) + @VIP (7 days) + @EventParticipant (3 hours)', 50, yPos, { width: 480 });

yPos += 25;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Use /rolestatus to see all active members and times at a glance:', 50, yPos, { width: 480 });

yPos += 25;
doc.fontSize(10)
  .fillColor(darkColor)
  .font('Courier')
  .text('/rolestatus @Booster', 50, yPos);

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 11: TROUBLESHOOTING ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('8. Troubleshooting', 50, 50);

const issues = [
  {
    problem: 'Bot not responding to commands',
    solutions: [
      '✓ Verify BoostMon is online (check member list)',
      '✓ Ensure you\'re using "/" to trigger slash commands',
      '✓ Check that the bot has "Use Application Commands" permission',
      '✓ Try typing "/" to see if slash commands appear'
    ]
  },
  {
    problem: 'Role not being removed after timer expires',
    solutions: [
      '✓ Verify bot role is positioned ABOVE the target role',
      '✓ Check bot has "Manage Roles" permission',
      '✓ Ensure the target role isn\'t protected/unmanageable',
      '✓ Check bot logs for permission errors'
    ]
  },
  {
    problem: 'Warning notifications not being sent',
    solutions: [
      '✓ Verify warning channel exists and is accessible',
      '✓ Check bot has "Send Messages" permission in that channel',
      '✓ Try using DM notifications instead (omit #channel parameter)',
      '✓ Ensure user has notifications enabled'
    ]
  },
  {
    problem: 'Timer showing incorrect remaining time',
    solutions: [
      '✓ Check your server timezone matches expected time',
      '✓ Verify timer was created with correct duration',
      '✓ Use /showtime to get precise remaining time',
      '✓ Contact support if discrepancy persists'
    ]
  }
];

yPos = 110;

issues.forEach((issue, index) => {
  if (yPos > 650) {
    addPageNumber(doc.bufferedPageRange().count);
    doc.addPage();
    yPos = 50;
  }

  doc.fontSize(12)
    .fillColor(accentColor)
    .font('Helvetica-Bold')
    .text(`❌ ${issue.problem}`, 50, yPos);
  yPos += 25;

  issue.solutions.forEach(solution => {
    doc.fontSize(10)
      .fillColor(darkColor)
      .font('Helvetica')
      .text(solution, 65, yPos, { width: 450 });
    yPos += 20;
  });

  yPos += 15;
});

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== PAGE 12: FAQ ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('9. Frequently Asked Questions', 50, 50);

const faqs = [
  {
    q: 'Will timers persist if the bot goes offline?',
    a: 'Yes! All timers are stored in PostgreSQL. The bot will continue processing timers even if temporarily offline.'
  },
  {
    q: 'Can I modify a timer after creation?',
    a: 'Absolutely! Use /addtime to extend, /removetime to reduce, or /cleartime to delete completely.'
  },
  {
    q: 'How long can a timer be?',
    a: 'Maximum 10,080 minutes (7 days) per command. Use /addtime to extend indefinitely beyond that.'
  },
  {
    q: 'Can users have multiple timers?',
    a: 'Yes! Each user can have multiple timed roles running simultaneously on different roles.'
  },
  {
    q: 'What if I remove a role manually?',
    a: 'The timer continues. When it expires, BoostMon will attempt removal again and clear the timer.'
  },
  {
    q: 'Is there a cost?',
    a: 'No! BoostMon is completely free. No premium tiers, no ads, no hidden charges.'
  },
  {
    q: 'How accurate are the timers?',
    a: 'Very accurate (±1 second). Timers are checked every 30 seconds for precision.'
  },
  {
    q: 'Can I customize warning times?',
    a: 'Default warnings are at 60, 10, and 1 minute. Contact support for custom thresholds.'
  }
];

yPos = 110;

faqs.forEach((faq, index) => {
  if (yPos > 680) {
    addPageNumber(doc.bufferedPageRange().count);
    doc.addPage();
    yPos = 50;
  }

  doc.fontSize(11)
    .fillColor(secondaryColor)
    .font('Helvetica-Bold')
    .text(`Q: ${faq.q}`, 50, yPos, { width: 480 });
  yPos += 30;

  doc.fontSize(10)
    .fillColor(darkColor)
    .font('Helvetica')
    .text(`A: ${faq.a}`, 65, yPos, { width: 450 });
  yPos += 35;
});

addPageNumber(doc.bufferedPageRange().count);
doc.addPage();

// ====== FINAL PAGE: SUPPORT ======
doc.fontSize(20)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('10. Support & Contact', 50, 50);

doc.fontSize(12)
  .fillColor(secondaryColor)
  .font('Helvetica-Bold')
  .text('Need Help?', 50, 120);

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('GitHub Repository', 50, 150)
  .fontSize(10)
  .fillColor('#3498DB')
  .font('Helvetica')
  .text('github.com/ubegformercy/nodejs', 50, 170);

yPos = 210;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Report Issues', 50, yPos)
  .fontSize(10)
  .fillColor('#3498DB')
  .font('Helvetica')
  .text('Create an issue on GitHub for bugs or feature requests', 50, yPos + 20);

yPos += 70;
doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Join Our Community', 50, yPos)
  .fontSize(10)
  .fillColor(darkColor)
  .font('Helvetica')
  .text('Connect with other BoostMon users and get support from the community', 50, yPos + 20, { width: 480 });

yPos += 80;
doc.fontSize(14)
  .fillColor(primaryColor)
  .font('Helvetica-Bold')
  .text('Key Resources', 50, yPos);

yPos += 40;
const resources = [
  '📖 Documentation: github.com/ubegformercy/nodejs',
  '🐛 Bug Reports: GitHub Issues',
  '💬 Discussions: GitHub Discussions',
  '⭐ Star Us: github.com/ubegformercy/nodejs'
];

doc.fontSize(11)
  .fillColor(darkColor)
  .font('Helvetica');

resources.forEach(resource => {
  doc.text(resource, 50, yPos);
  yPos += 25;
});

yPos += 40;
doc.fontSize(13)
  .fillColor(accentColor)
  .font('Helvetica-Bold')
  .text('Thank You for Using BoostMon! 🚀', 50, yPos, { align: 'center', width: 480 });

yPos += 30;
doc.fontSize(10)
  .fillColor('#7F8C8D')
  .font('Helvetica')
  .text('Professional Discord Bot for Timed Role Management', 50, yPos, { align: 'center', width: 480 });

yPos += 25;
doc.fontSize(9)
  .fillColor('#95A5A6')
  .font('Helvetica')
  .text('© 2026 Epic Forge Studios. All rights reserved.', 50, yPos, { align: 'center', width: 480 });

addPageNumber(doc.bufferedPageRange().count);

// Finalize PDF
doc.end();

// Handle stream finish
stream.on('finish', () => {
  console.log(`✅ PDF generated successfully: ${outputPath}`);
  console.log(`📄 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
});

stream.on('error', (err) => {
  console.error('❌ Error generating PDF:', err);
});
