#!/usr/bin/env node

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

console.log('Starting PDF generation...');

try {
  // Create document
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40
  });

  const filename = path.join(__dirname, 'BoostMon_User_Guide.pdf');
  console.log(`Output file: ${filename}`);

  // Create write stream
  const stream = fs.createWriteStream(filename);
  
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    process.exit(1);
  });

  doc.pipe(stream);

  // ===== TITLE PAGE =====
  doc.fontSize(48)
    .font('Helvetica-Bold')
    .text('BoostMon', { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(20)
    .font('Helvetica')
    .text('Professional Discord Timed Role Manager', { align: 'center' });

  doc.moveDown(2);
  
  // Try to add logo if it exists
  const logoPath = path.join(__dirname, 'public/images/boostmon.png');
  if (fs.existsSync(logoPath)) {
    console.log('Adding logo...');
    try {
      doc.image(logoPath, 100, 200, { width: 350, height: 350 });
      doc.moveDown(15);
    } catch (e) {
      console.warn('Could not add logo:', e.message);
    }
  }

  doc.fontSize(12)
    .text('User Guide & Complete Documentation', { align: 'center' });

  doc.moveDown(1);
  doc.fontSize(10)
    .fillColor('#888')
    .text('Version 1.0 | January 2026 | © Epic Forge Studios', { align: 'center' });

  // New page
  doc.addPage();

  // ===== TOC =====
  doc.fontSize(28)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('Table of Contents');

  doc.moveDown(0.5);
  doc.fontSize(12)
    .fillColor('#000')
    .font('Helvetica');

  const toc = [
    '1. What is BoostMon?',
    '2. Key Features',
    '3. Getting Started',
    '4. Command Reference',
    '5. Real-World Examples',
    '6. Advanced Features',
    '7. Troubleshooting',
    '8. FAQ',
    '9. Support & Contact'
  ];

  toc.forEach(item => {
    doc.text(item);
  });

  // Page 3
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('1. What is BoostMon?');

  doc.moveDown(0.5);
  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica');

  doc.text('BoostMon is a professional Discord bot designed for managing timed roles. It provides automated role assignment, expiration tracking, and notification systems for your Discord community.');

  doc.moveDown(1);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Perfect For:');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica');

  const useCases = [
    '• Roblox private server boost tracking',
    '• VIP membership expiration',
    '• Temporary event roles',
    '• Gaming guilds and communities',
    '• Subscription-based access control'
  ];

  useCases.forEach(use => {
    doc.text(use);
  });

  // Page 4
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('2. Key Features');

  doc.moveDown(0.5);
  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica');

  const features = [
    { title: '⏱️ Precise Timers', desc: 'Set exact durations down to the minute' },
    { title: '🔔 Smart Alerts', desc: 'Warnings at 60, 10, and 1 minute marks' },
    { title: '⏸️ Pause & Resume', desc: 'Freeze timers temporarily without losing progress' },
    { title: '📊 Batch Operations', desc: 'View all users with a role and their times' },
    { title: '💾 Persistent Storage', desc: 'PostgreSQL database - timers survive restarts' },
    { title: '🚀 Performance', desc: 'Sub-100ms response times, handles 1000+ users' },
    { title: '🔒 Secure', desc: 'Respects Discord role hierarchy' },
    { title: '✅ Easy to Use', desc: 'Simple slash commands, no complex setup' }
  ];

  features.forEach(feature => {
    doc.fontSize(12)
      .fillColor('#E74C3C')
      .font('Helvetica-Bold')
      .text(feature.title);
    doc.fontSize(11)
      .fillColor('#000')
      .font('Helvetica')
      .text(feature.desc);
    doc.moveDown(0.3);
  });

  // Page 5
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('3. Getting Started');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Step 1: Invite the Bot');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('1. Go to top.gg and search for BoostMon');
  doc.text('2. Click "Invite" button');
  doc.text('3. Select your server');
  doc.text('4. Authorize required permissions');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Step 2: Configure Bot Role');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('1. Go to Server Settings → Roles');
  doc.text('2. Move BoostMon role ABOVE the roles you want to manage');
  doc.text('3. This ensures it has permission to assign/remove those roles');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Step 3: Create Your First Timer');

  doc.fontSize(10)
    .fillColor('#444')
    .font('Courier')
    .text('/settime @username 60 @RoleName #announcements');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('This sets a 60-minute timer with role assignment and channel alerts.');

  // Page 6 - Commands
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('4. Command Reference');

  doc.moveDown(0.5);

  const commands = [
    {
      cmd: '/settime @user <minutes> @role [#channel]',
      desc: 'Create or update a timed role'
    },
    {
      cmd: '/addtime @user <minutes> [@role]',
      desc: 'Add minutes to existing timer'
    },
    {
      cmd: '/removetime @user <minutes> [@role]',
      desc: 'Remove minutes from timer'
    },
    {
      cmd: '/cleartime @user [@role]',
      desc: 'Delete timer and remove role'
    },
    {
      cmd: '/pausetime @user [@role]',
      desc: 'Pause timer (freeze countdown)'
    },
    {
      cmd: '/resumetime @user @role',
      desc: 'Resume paused timer'
    },
    {
      cmd: '/showtime [@user] [@role]',
      desc: 'Check remaining time'
    },
    {
      cmd: '/rolestatus @role',
      desc: 'See all users with role and times'
    }
  ];

  commands.forEach(cmd => {
    doc.fontSize(10)
      .fillColor('#444')
      .font('Courier')
      .text(cmd.cmd);
    doc.fontSize(10)
      .fillColor('#666')
      .font('Helvetica')
      .text(`→ ${cmd.desc}`);
    doc.moveDown(0.4);
  });

  // Page 7
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('5. Real-World Examples');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Example 1: Roblox Daily Boosts');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Track players who boost for 24 hours:');

  doc.fontSize(9)
    .fillColor('#444')
    .font('Courier')
    .text('/settime @player1 1440 @Active-Booster #boost-logs');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Result: Auto-removes after 24h. Warnings sent at 60, 10, 1 minute.');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Example 2: VIP Membership');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('30-day VIP subscription (43,200 minutes):');

  doc.fontSize(9)
    .fillColor('#444')
    .font('Courier')
    .text('/settime @member 43200 @VIP-Premium #vip-channel');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Result: Member keeps VIP role for exactly 30 days, then auto-removed.');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Example 3: Taking a Break');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Pause before absence, resume when back:');

  doc.fontSize(9)
    .fillColor('#444')
    .font('Courier')
    .text('/pausetime @player @Booster');
  doc.text('(... time passes ...)');
  doc.text('/resumetime @player @Booster');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Result: Timer frozen and resumed from same point.');

  // Page 8
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('6. Advanced Features');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Smart Warning System');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica');

  doc.text('⏰ 60 Minutes: Early warning - plenty of time to act');
  doc.text('⚠️  10 Minutes: Urgent reminder - prepare to renew');
  doc.text('🔴 1 Minute: Critical alert - last chance');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Notification Channels');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Warnings can be sent to:');
  doc.text('• Public channel - Everyone sees alerts');
  doc.text('• User DM - Private notifications');

  doc.moveDown(0.5);
  doc.fontSize(13)
    .fillColor('#3498DB')
    .font('Helvetica-Bold')
    .text('Multiple Timers Per User');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('Users can have many timed roles active:');
  doc.text('• @Booster (1 day)');
  doc.text('• @VIP (7 days)');
  doc.text('• @EventParticipant (3 hours)');

  // Page 9
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('7. Troubleshooting');

  doc.moveDown(0.5);

  const troubleshooting = [
    {
      issue: 'Bot not responding',
      fix: '✓ Check bot is online\n✓ Use "/" to trigger slash commands\n✓ Verify "Use Application Commands" permission'
    },
    {
      issue: 'Role not removed',
      fix: '✓ Bot role must be ABOVE target role\n✓ Check "Manage Roles" permission\n✓ Ensure role isn\'t protected'
    },
    {
      issue: 'Warnings not sent',
      fix: '✓ Verify channel exists and is accessible\n✓ Check "Send Messages" permission\n✓ Ensure user has notifications enabled'
    },
    {
      issue: 'Wrong time shown',
      fix: '✓ Use /showtime for exact time\n✓ Check timer was created correctly\n✓ Verify server timezone'
    }
  ];

  troubleshooting.forEach(t => {
    doc.fontSize(12)
      .fillColor('#E74C3C')
      .font('Helvetica-Bold')
      .text(`❌ ${t.issue}`);
    doc.fontSize(10)
      .fillColor('#000')
      .font('Helvetica')
      .text(t.fix);
    doc.moveDown(0.5);
  });

  // Page 10
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('8. FAQ');

  doc.moveDown(0.5);

  const faqs = [
    {
      q: 'Do timers persist if bot goes offline?',
      a: 'Yes! PostgreSQL database keeps all timers. Bot processes them after restart.'
    },
    {
      q: 'Can I modify timers after creating?',
      a: 'Yes! Use /addtime, /removetime, or /cleartime anytime.'
    },
    {
      q: 'Maximum timer length?',
      a: '10,080 minutes (7 days) per command. Use /addtime to extend further.'
    },
    {
      q: 'Can one user have multiple timers?',
      a: 'Yes! Each user can have multiple timed roles simultaneously.'
    },
    {
      q: 'What if I remove role manually?',
      a: 'Timer continues. BoostMon will retry when it expires.'
    },
    {
      q: 'Is there a cost?',
      a: 'No! Completely free, no premium tiers or ads.'
    }
  ];

  faqs.forEach(faq => {
    doc.fontSize(11)
      .fillColor('#3498DB')
      .font('Helvetica-Bold')
      .text(`Q: ${faq.q}`);
    doc.fontSize(10)
      .fillColor('#000')
      .font('Helvetica')
      .text(`A: ${faq.a}`);
    doc.moveDown(0.3);
  });

  // Page 11
  doc.addPage();
  doc.fontSize(24)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('9. Support & Contact');

  doc.moveDown(1);
  doc.fontSize(14)
    .fillColor('#000')
    .font('Helvetica-Bold')
    .text('GitHub Repository:');

  doc.fontSize(11)
    .fillColor('#3498DB')
    .font('Helvetica')
    .text('github.com/ubegformercy/nodejs');

  doc.moveDown(1);
  doc.fontSize(14)
    .fillColor('#000')
    .font('Helvetica-Bold')
    .text('How to Get Help:');

  doc.fontSize(11)
    .fillColor('#000')
    .font('Helvetica')
    .text('1. Check GitHub documentation');
  doc.text('2. Search existing GitHub issues');
  doc.text('3. Create a new GitHub issue with details');
  doc.text('4. Join community Discord (if available)');

  doc.moveDown(1);
  doc.fontSize(13)
    .fillColor('#2ECC71')
    .font('Helvetica-Bold')
    .text('Thank You for Using BoostMon!', { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(11)
    .fillColor('#666')
    .font('Helvetica')
    .text('Professional Discord Bot for Timed Role Management', { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(9)
    .fillColor('#999')
    .font('Helvetica')
    .text('© 2026 Epic Forge Studios. All rights reserved.', { align: 'center' });

  // Finalize
  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(filename);
    console.log(`✅ PDF created successfully!`);
    console.log(`📄 File: ${filename}`);
    console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
