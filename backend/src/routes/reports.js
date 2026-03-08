const express = require('express');
const router = express.Router();
const ReportingService = require('../services/reporting');
const logger = require('../utils/logger');

// GET /api/v1/reports/weekly-fuel - Weekly fuel efficiency report
router.get('/weekly-fuel', async (req, res) => {
  try {
    const result = await ReportingService.generateWeeklyFuelReport();
    res.json(result);
  } catch (error) {
    logger.error('Error in weekly fuel report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/reports/driver-leaderboard - Driver performance ranking
router.get('/driver-leaderboard', async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await ReportingService.generateDriverLeaderboard(
      limit ? parseInt(limit) : 20
    );
    res.json(result);
  } catch (error) {
    logger.error('Error in driver leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/reports/maintenance-schedule - Maintenance urgency report
router.get('/maintenance-schedule', async (req, res) => {
  try {
    const result = await ReportingService.generateMaintenanceSchedule();
    res.json(result);
  } catch (error) {
    logger.error('Error in maintenance schedule report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/reports/anomalies - Fuel theft, aggressive driving, overspeed
router.get('/anomalies', async (req, res) => {
  try {
    const { timeRange } = req.query;
    const result = await ReportingService.generateAnomalyReport(
      timeRange || '7days'
    );
    res.json(result);
  } catch (error) {
    logger.error('Error in anomaly report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/reports/cost-analysis - Cost breakdown by route and component
router.get('/cost-analysis', async (req, res) => {
  try {
    const result = await ReportingService.generateCostAnalysisReport();
    res.json(result);
  } catch (error) {
    logger.error('Error in cost analysis report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
