// Dashboard API Routes
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/dashboard
 * Returns stats and data for the dashboard
 */
router.get('/api/dashboard', async (req, res) => {
  try {
    // Get all timers (global, not guild-specific)
    let allTimers = [];
    try {
      allTimers = await db.getAllActiveTimers().catch(() => []);
    } catch (err) {
      console.error('Error fetching timers:', err);
    }
    
    // Get all role status schedules - need to get from all guilds
    let schedules = [];
    try {
      const result = await db.pool.query(
        'SELECT * FROM rolestatus_schedules WHERE enabled = true'
      );
      schedules = result.rows || [];
    } catch (err) {
      console.error('Error fetching schedules:', err);
      schedules = [];
    }

    // Get all autopurge settings - need to get from all guilds
    let autopurges = [];
    try {
      const result = await db.pool.query(
        'SELECT * FROM autopurge_settings WHERE enabled = true'
      );
      autopurges = result.rows || [];
    } catch (err) {
      console.error('Error fetching autopurges:', err);
      autopurges = [];
    }

    // Format timers for display
    const formattedTimers = (allTimers || []).map(timer => {
      const remaining = Math.max(0, Number(timer.expires_at) - Date.now());
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      return {
        user: `<@${timer.user_id}>`,
        role: `<@&${timer.role_id}>`,
        remaining: remaining,
        formattedTime: `${hours}h ${minutes}m ${seconds}s`,
        expiresAt: timer.expires_at,
        paused: timer.paused,
      };
    }).filter(t => t !== null && t !== undefined);

    // Format schedules for display
    const formattedSchedules = (schedules || []).map(schedule => {
      const lastReport = schedule.last_report_at 
        ? new Date(schedule.last_report_at).toLocaleString()
        : 'Never';
      
      const nextReportMs = schedule.last_report_at 
        ? new Date(schedule.last_report_at).getTime() + (schedule.interval_minutes * 60 * 1000)
        : Date.now() + (schedule.interval_minutes * 60 * 1000);
      
      const nextReport = new Date(nextReportMs).toLocaleString();

      return {
        role: `<@&${schedule.role_id}>`,
        channel: `<#${schedule.channel_id}>`,
        interval: schedule.interval_minutes,
        lastReport: lastReport,
        nextReport: nextReport,
      };
    }).filter(s => s !== null && s !== undefined);

    // Format autopurge settings for display
    const formattedAutopurge = (autopurges || []).map(setting => {
      const lastPurge = setting.last_purge_at
        ? new Date(setting.last_purge_at).toLocaleString()
        : 'Never';

      return {
        channel: `<#${setting.channel_id}>`,
        type: setting.type,
        lines: setting.lines,
        interval: Math.ceil(setting.interval_seconds / 60),
        lastPurge: lastPurge,
      };
    }).filter(a => a !== null && a !== undefined);

    console.log('Dashboard data loaded:', {
      timersCount: formattedTimers.length,
      schedulesCount: formattedSchedules.length,
      autopurgesCount: formattedAutopurge.length,
    });

    // Build response
    const response = {
      botStatus: 'online',
      stats: {
        activeTimers: formattedTimers.length,
        scheduledReports: formattedSchedules.length,
        autopurgeSettings: formattedAutopurge.length,
      },
      timers: formattedTimers,
      reports: formattedSchedules,
      autopurge: formattedAutopurge,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (err) {
    console.error('Dashboard API error:', err);
    res.status(500).json({
      error: 'Failed to load dashboard data',
      details: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
