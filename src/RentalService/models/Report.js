/**
 * Report.js
 * A dispute report filed by a user (e.g. someone blocked their rented spot).
 *
 * Maps to the Reports table in the database schema (Review.md §II).
 *
 * Lifecycle:
 *   pending → investigating → resolved | dismissed
 *
 * Reports can trigger automatic actions (spot reassignment, fines)
 * or be escalated to an admin for manual review.
 */

const { REPORT_TYPES, REPORT_STATUS } = require('../utils/constants');

class Report {
  /**
   * @param {Object} data
   * @param {string}   data.reportId         - UUID primary key
   * @param {string}   data.reporterUserId   - User who filed the report
   * @param {string}   [data.reportedUserId] - User being reported (if known)
   * @param {string}   [data.rentalId]       - Related rental (nullable)
   * @param {string}   data.reportType       - One of REPORT_TYPES
   * @param {string}   data.description      - Free-text description of the issue
   * @param {string[]} data.photoUrls        - Evidence photos
   * @param {string}   data.status           - Current report status
   * @param {string}   [data.adminNotes]     - Notes from admin review
   * @param {Date}     [data.createdAt]
   * @param {Date}     [data.resolvedAt]
   */
  constructor({
    reportId,
    reporterUserId,
    reportedUserId = null,
    rentalId = null,
    reportType,
    description = '',
    photoUrls = [],
    status = REPORT_STATUS.PENDING,
    adminNotes = '',
    createdAt = new Date(),
    resolvedAt = null,
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
    this.photoUrls = photoUrls;
    this.status = status;
    this.adminNotes = adminNotes;
    this.createdAt = createdAt;
    this.resolvedAt = resolvedAt;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()       { return this.status === REPORT_STATUS.PENDING; }
  isInvestigating() { return this.status === REPORT_STATUS.INVESTIGATING; }
  isResolved()      { return this.status === REPORT_STATUS.RESOLVED; }
  isDismissed()     { return this.status === REPORT_STATUS.DISMISSED; }
  isOpen()          { return this.isPending() || this.isInvestigating(); }

  /** Is this a blocked-spot report that can trigger automatic reassignment? */
  isBlockedSpotReport() {
    return this.reportType === REPORT_TYPES.BLOCKED_SPOT;
  }

  // ── Status Transitions ──────────────────────────────────────────────────

  startInvestigation() {
    if (!this.isPending()) {
      throw new Error(`Cannot investigate report in '${this.status}' status`);
    }
    this.status = REPORT_STATUS.INVESTIGATING;
  }

  resolve(adminNotes = '') {
    if (!this.isOpen()) {
      throw new Error(`Cannot resolve report in '${this.status}' status`);
    }
    this.status = REPORT_STATUS.RESOLVED;
    this.adminNotes = adminNotes || this.adminNotes;
    this.resolvedAt = new Date();
  }

  dismiss(adminNotes = '') {
    if (!this.isOpen()) {
      throw new Error(`Cannot dismiss report in '${this.status}' status`);
    }
    this.status = REPORT_STATUS.DISMISSED;
    this.adminNotes = adminNotes || this.adminNotes;
    this.resolvedAt = new Date();
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  addPhoto(url) {
    this.photoUrls.push(url);
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
      photoUrls: this.photoUrls,
      status: this.status,
      adminNotes: this.adminNotes,
      createdAt: this.createdAt,
      resolvedAt: this.resolvedAt,
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
      photoUrls: data.photo_urls || data.photoUrls || [],
      status: data.status || REPORT_STATUS.PENDING,
      adminNotes: data.admin_notes || data.adminNotes || '',
      createdAt: data.created_at || data.createdAt,
      resolvedAt: data.resolved_at || data.resolvedAt || null,
    });
  }
}

module.exports = Report;
