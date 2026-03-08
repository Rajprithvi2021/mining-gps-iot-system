/**
 * Alert Manager Service
 * ====================
 * Handles alert deduplication, escalation, and notifications
 *
 * Responsibilities:
 * 1. Consume anomalies from queue
 * 2. Deduplicate (same location, similar time)
 * 3. Escalate (multiple incidents → call manager)
 * 4. WebSocket broadcast to connected users
 * 5. Email/SMS for critical alerts
 */

import { Pool } from 'pg';
import Bull from 'bull';
import { EventEmitter } from 'events';
import { Alert, Anomaly, AlertSeverity, AlertStatus } from '../types';

interface AlertConfig {
  deduplicationWindowSec: number;
  emailThreshold: AlertSeverity;
  smsThreshold: AlertSeverity;
  escalationCount: number;
}

export class AlertManagerService extends EventEmitter {
  private db: Pool;
  private anomalyQueue: Bull.Queue;
  private alertQueue: Bull.Queue;
  private config: AlertConfig;
  private recentAlerts: Map<string, Alert> = new Map();

  constructor(
    db: Pool,
    anomalyQueue: Bull.Queue,
    alertQueue: Bull.Queue,
    config: Partial<AlertConfig> = {}
  ) {
    super();
    this.db = db;
    this.anomalyQueue = anomalyQueue;
    this.alertQueue = alertQueue;
    this.config = {
      deduplicationWindowSec: config.deduplicationWindowSec || 300,
      emailThreshold: config.emailThreshold || AlertSeverity.HIGH,
      smsThreshold: config.smsThreshold || AlertSeverity.CRITICAL,
      escalationCount: config.escalationCount || 3,
    };

    // Process anomaly queue
    this.anomalyQueue.process(1, async (job) => {
      return this.handleAnomaly(job.data);
    });

    console.log('✅ Alert Manager Service initialized');
  }

  /**
   * Handle incoming anomaly
   */
  private async handleAnomaly(anomaly: Anomaly): Promise<void> {
    try {
      // Check for duplicate in recent window
      const dedupeKey = this.generateDedupeKey(anomaly);
      if (this.shouldIgnore(dedupeKey)) {
        console.log(`⏭️ Skipped duplicate: ${dedupeKey}`);
        return;
      }

      // Get vehicle info
      const vehicle = await this.getVehicle(anomaly.vehicleId);
      if (!vehicle) {
        console.error(`Unknown vehicle: ${anomaly.vehicleId}`);
        return;
      }

      // Get organization
      const org = await this.getOrganization(vehicle.org_id);
      if (!org) {
        console.error(`Unknown org: ${vehicle.org_id}`);
        return;
      }

      // Create alert
      const alert: Alert = {
        id: 0,  // Will be assigned by DB
        orgId: org.id,
        anomalyId: anomaly.id,
        vehicleId: anomaly.vehicleId,
        alertType: anomaly.anomalyType,
        severity: anomaly.severity,
        message: this.formatAlertMessage(anomaly, vehicle),
        status: AlertStatus.NEW,
        sentAt: new Date(),
      };

      // Store alert
      await this.storeAlert(alert, org.id);

      // Broadcast to WebSocket subscribers
      this.emit('alert-created', {
        orgId: org.id,
        alert,
        vehicleId: vehicle.id,
        vehicleName: vehicle.vehicle_id,
      });

      // Send notifications based on severity
      if (anomaly.severity === AlertSeverity.CRITICAL) {
        await this.sendCriticalNotification(alert, vehicle, org);
      } else if (anomaly.severity === AlertSeverity.HIGH) {
        await this.sendHighPriorityNotification(alert, vehicle, org);
      }

      // Check for escalation (multiple cascading incidents)
      const recentCount = await this.getRecentAnomalyCount(
        anomaly.vehicleId,
        60  // Last 1 minute
      );

      if (recentCount >= this.config.escalationCount) {
        await this.escalateToManager(vehicle, org, recentCount);
      }

      console.log(
        `✅ Alert created: ${anomaly.anomalyType} for ${vehicle.vehicle_id}`
      );
    } catch (err) {
      console.error('❌ Error handling anomaly:', err);
    }
  }

  /**
   * Generate deduplication key for anomaly
   */
  private generateDedupeKey(anomaly: Anomaly): string {
    // Group by vehicle, type, and location (within 200m)
    const latBucket = Math.floor(anomaly.latitude! * 1000);
    const lonBucket = Math.floor(anomaly.longitude! * 1000);
    return `${anomaly.vehicleId}-${anomaly.anomalyType}-${latBucket}-${lonBucket}`;
  }

  /**
   * Check if alert should be deduplicated
   */
  private shouldIgnore(key: string): boolean {
    if (!this.recentAlerts.has(key)) {
      this.recentAlerts.set(key, {} as Alert);

      // Remove after dedup window
      setTimeout(() => {
        this.recentAlerts.delete(key);
      }, this.config.deduplicationWindowSec * 1000);

      return false;
    }

    return true;
  }

  /**
   * Format human-readable alert message
   */
  private formatAlertMessage(
    anomaly: Anomaly,
    vehicle: any
  ): string {
    const messages: Record<string, string> = {
      ROUTE_DEVIATION: `🚨 Vehicle ${vehicle.vehicle_id} deviated from route by ${anomaly.data.deviation_m}m`,
      IDLE_DETECTION: `⏰ Vehicle ${vehicle.vehicle_id} idle for ${anomaly.durationSec}s (cost: $${anomaly.data.cost_usd})`,
      HARSH_ACCELERATION: `⚡ Vehicle ${vehicle.vehicle_id} harsh acceleration: ${anomaly.data.acceleration_ms2}m/s²`,
      HARSH_BRAKING: `🛑 Vehicle ${vehicle.vehicle_id} harsh braking: ${Math.abs(anomaly.data.deceleration_ms2)}m/s²`,
      FUEL_ANOMALY: `⛽ Fuel consumption anomaly for ${vehicle.vehicle_id}: ${anomaly.data.zscore}σ above normal`,
      GRADE_ALERT: `⛰️ Vehicle ${vehicle.vehicle_id} on ${anomaly.data.grade_percent}% grade`,
    };

    return messages[anomaly.anomalyType] || 'Anomaly detected';
  }

  /**
   * Send critical alert notification
   */
  private async sendCriticalNotification(
    alert: Alert,
    vehicle: any,
    org: any
  ): Promise<void> {
    try {
      // Get managers for this org
      const result = await this.db.query(
        `SELECT id, email, phone FROM users
         WHERE org_id = $1 AND role = 'manager' AND status = 'active'`,
        [org.id]
      );

      const managers = result.rows;

      // Send SMS to first manager
      if (managers.length > 0 && managers[0].phone) {
        console.log(`📱 SMS to ${managers[0].phone}: ${alert.message}`);
        // await this.sendSMS(managers[0].phone, alert.message);
      }

      // Send email to all managers
      for (const manager of managers) {
        console.log(`📧 Email to ${manager.email}: ${alert.message}`);
        // await this.sendEmail(manager.email, alert.message, alert);
      }
    } catch (err) {
      console.error('Error sending critical notification:', err);
    }
  }

  /**
   * Send high-priority notification
   */
  private async sendHighPriorityNotification(
    alert: Alert,
    vehicle: any,
    org: any
  ): Promise<void> {
    try {
      // Send to dashboard via WebSocket (only)
      this.emit('high-priority-alert', {
        orgId: org.id,
        alert,
        message: 'Please review this alert',
      });

      console.log(`📊 High-priority alert broadcast to ${org.id}`);
    } catch (err) {
      console.error('Error sending high-priority notification:', err);
    }
  }

  /**
   * Escalate to manager (multiple incidents)
   */
  private async escalateToManager(
    vehicle: any,
    org: any,
    incidentCount: number
  ): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT id, email, phone FROM users
         WHERE org_id = $1 AND role = 'admin' LIMIT 1`,
        [org.id]
      );

      if (result.rows.length > 0) {
        const admin = result.rows[0];
        const escalationMessage =
          `🚨 ESCALATION: Vehicle ${vehicle.vehicle_id} has triggered ` +
          `${incidentCount} anomalies in the last minute. ` +
          `Potential system malfunction or driver safety issue.`;

        console.log(`📞 Escalation alert: ${escalationMessage}`);
        // await this.sendSMS(admin.phone, escalationMessage);
      }
    } catch (err) {
      console.error('Error escalating alert:', err);
    }
  }

  /**
   * Get vehicle info
   */
  private async getVehicle(vehicleId: number): Promise<any> {
    try {
      const result = await this.db.query(
        'SELECT id, org_id, vehicle_id, type FROM vehicles WHERE id = $1',
        [vehicleId]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching vehicle:', err);
      return null;
    }
  }

  /**
   * Get organization info
   */
  private async getOrganization(orgId: number): Promise<any> {
    try {
      const result = await this.db.query(
        'SELECT id, name, timezone FROM organizations WHERE id = $1',
        [orgId]
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error fetching organization:', err);
      return null;
    }
  }

  /**
   * Store alert to database
   */
  private async storeAlert(alert: Alert, orgId: number): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO alerts (org_id, anomaly_id, vehicle_id, alert_type, severity, message, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId,
          alert.anomalyId,
          alert.vehicleId,
          alert.alertType,
          alert.severity,
          alert.message,
          alert.status,
          alert.sentAt,
        ]
      );
    } catch (err) {
      console.error('Error storing alert:', err);
    }
  }

  /**
   * Get count of recent anomalies for vehicle
   */
  private async getRecentAnomalyCount(
    vehicleId: number,
    lastSeconds: number
  ): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) FROM anomalies
         WHERE vehicle_id = $1
         AND timestamp > NOW() - INTERVAL '${lastSeconds} seconds'`,
        [vehicleId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (err) {
      console.error('Error counting recent anomalies:', err);
      return 0;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: number): Promise<void> {
    try {
      await this.db.query(
        `UPDATE alerts SET status = $1, acknowledged_at = NOW()
         WHERE id = $2`,
        [AlertStatus.ACKNOWLEDGED, alertId]
      );

      this.emit('alert-acknowledged', { alertId });
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: number): Promise<void> {
    try {
      await this.db.query(
        `UPDATE alerts SET status = $1, resolved_at = NOW()
         WHERE id = $2`,
        [AlertStatus.RESOLVED, alertId]
      );

      this.emit('alert-resolved', { alertId });
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  }

  /**
   * Get alerts for organization
   */
  async getAlerts(orgId: number, limit: number = 100): Promise<Alert[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM alerts WHERE org_id = $1
         ORDER BY sent_at DESC LIMIT $2`,
        [orgId, limit]
      );

      return result.rows;
    } catch (err) {
      console.error('Error fetching alerts:', err);
      return [];
    }
  }
}
