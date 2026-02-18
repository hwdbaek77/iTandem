const UserType = require('../enums/UserType');
const Permission = require('../enums/Permission');

class User {
  /**
   * @param {Object} params
   * @param {string} params.userID
   * @param {string} params.name
   * @param {string} params.email
   * @param {string} params.licensePlate
   * @param {string} params.phoneNumber
   * @param {string} params.userType - A value from the UserType enum
   * @param {string} params.apiKey
   * @param {string[]} params.permissions - An array of values from the Permission enum
   * @param {string} [params.canvasAccessToken] - Canvas LMS API access token
   * @param {boolean} [params.canvasDataLinked] - Whether Canvas data is linked
   * @param {string} [params.canvasUserId] - Canvas user ID
   * @param {string} [params.canvasUserName] - Canvas display name
   * @param {string} [params.canvasEmail] - Canvas email
   * @param {Object} [params.canvasData] - Cached Canvas data (courses, schedule, etc.)
   * @param {Date} [params.createdAt] - Account creation timestamp
   * @param {Date} [params.updatedAt] - Last update timestamp
   */
  constructor({ 
    userID, 
    name, 
    email, 
    licensePlate, 
    phoneNumber, 
    userType, 
    apiKey, 
    permissions,
    canvasAccessToken,
    canvasDataLinked,
    canvasUserId,
    canvasUserName,
    canvasEmail,
    canvasData,
    createdAt,
    updatedAt
  }) {
    // Core user fields
    this.userID = userID;
    this.name = name;
    this.email = email;
    this.licensePlate = licensePlate;
    this.phoneNumber = phoneNumber;
    this.userType = userType;
    this.apiKey = apiKey;
    this.permissions = permissions || [];
    
    // Canvas integration fields
    this.canvasAccessToken = canvasAccessToken || null;
    this.canvasDataLinked = canvasDataLinked || false;
    this.canvasUserId = canvasUserId || null;
    this.canvasUserName = canvasUserName || null;
    this.canvasEmail = canvasEmail || null;
    this.canvasData = canvasData || null;
    
    // Timestamps
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Handles user authentication.
   * Will be fully implemented when the authentication service is built.
   */
  authenticate() {
    // TODO: Implement with authentication service (OAuth/Didax integration)
  }

  /**
   * Updates mutable user profile fields.
   * SECURITY: userType is NOT updatable via this method to prevent privilege escalation.
   * @param {Object} data - An object containing the fields to update
   * @param {string} [data.name]
   * @param {string} [data.email]
   * @param {string} [data.licensePlate]
   * @param {string} [data.phoneNumber]
   */
  updateProfile(data) {
    const updatableFields = ['name', 'email', 'licensePlate', 'phoneNumber'];

    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    }
  }

  /**
   * Checks if the user has a specific permission.
   * @param {string} permission - A value from the Permission enum
   * @returns {boolean} Whether the user has the permission
   */
  checkPermissions(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * Checks if user has linked their Canvas account.
   * @returns {boolean} Whether Canvas data is linked
   */
  hasCanvasLinked() {
    return this.canvasDataLinked === true && this.canvasAccessToken !== null;
  }

  /**
   * Gets the user's Canvas schedule information for compatibility matching.
   * @returns {Object|null} Schedule information or null if not available
   */
  getScheduleInfo() {
    if (!this.canvasData || !this.canvasData.scheduleInfo) {
      return null;
    }
    return this.canvasData.scheduleInfo;
  }

  /**
   * Converts user object to a safe format for API responses (removes sensitive data).
   * @returns {Object} Safe user object without sensitive fields
   */
  toSafeObject() {
    const safeUser = { ...this };
    delete safeUser.canvasAccessToken;
    delete safeUser.apiKey;
    return safeUser;
  }

  /**
   * Converts user object to Firestore document format.
   * @returns {Object} Firestore-compatible user document
   */
  toFirestoreDocument() {
    return {
      userID: this.userID,
      name: this.name,
      email: this.email,
      licensePlate: this.licensePlate,
      phoneNumber: this.phoneNumber,
      userType: this.userType,
      apiKey: this.apiKey,
      permissions: this.permissions,
      canvasAccessToken: this.canvasAccessToken,
      canvasDataLinked: this.canvasDataLinked,
      canvasUserId: this.canvasUserId,
      canvasUserName: this.canvasUserName,
      canvasEmail: this.canvasEmail,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates a User instance from a Firestore document.
   * @param {Object} doc - Firestore document data
   * @returns {User} User instance
   */
  static fromFirestoreDocument(doc) {
    return new User(doc);
  }
}

module.exports = User;
