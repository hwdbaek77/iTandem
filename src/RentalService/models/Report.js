/**
 * Report.js
 * Minimal report class for blocked-spot incidents.
 * Used internally for automatic reassignment logic.
 * Admin workflow and photo verification removed (secondary features).
 */

const { REPORT_TYPES } = require('../utils/constants');

class Report {
  /**
   * @param {Object} data
   * @param {string}   data.reportId         - UUID primary key
   * @param {string}   data.reporterUserId   - User who filed the report
   * @param {string}   [data.reportedUserId] - User being reported (if known)
   * @param {string}   [data.rentalId]       - Related rental (nullable)
   * @param {string}   data.reportType       - One of REPORT_TYPES
   * @param {string}   data.description      - Free-text description of the issue
   * @param {Date}     [data.createdAt]
   */
  constructor({
    reportId,
    reporterUserId,
    reportedUserId = null,
    rentalId = null,
    reportType,
    description = '',
    createdAt = new Date(),
  }) {
    if (!reportId) throw new Error('Report requires a reportId');
    if (!reporterUserId) throw new Error('Report requires a reporterUserId');
    if (!Object.values(REPORT_TYPES).includes(reportType)) {
      throw new Error(`Invalid report type: ${reportType}`);
    }

    this.reportId = reportId;
    this.reporterUserId = reporterUserId;
    this.reportedUserId = reportedUserId;
    this.rentalId = rentalId;
    this.reportType = reportType;
    this.description = description;
    this.createdAt = createdAt;
  }

  /** Is this a blocked-spot report that can trigger automatic reassignment? */
  isBlockedSpotReport() {
    return this.reportType === REPORT_TYPES.BLOCKED_SPOT;
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      reportId: this.reportId,
      reporterUserId: this.reporterUserId,
      reportedUserId: this.reportedUserId,
      rentalId: this.rentalId,
      reportType: this.reportType,
      description: this.description,
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data) {
    return new Report({
      reportId: data.report_id || data.reportId,
      reporterUserId: data.reporter_user_id || data.reporterUserId,
      reportedUserId: data.reported_user_id || data.reportedUserId || null,
      rentalId: data.rental_id || data.rentalId || null,
      reportType: data.report_type || data.reportType,
      description: data.description || '',
      createdAt: data.created_at || data.createdAt,
    });
  }
}

module.exports = Report;
