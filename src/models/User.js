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
   */
  constructor({ userID, name, email, licensePlate, phoneNumber, userType, apiKey, permissions }) {
    this.userID = userID;
    this.name = name;
    this.email = email;
    this.licensePlate = licensePlate;
    this.phoneNumber = phoneNumber;
    this.userType = userType;
    this.apiKey = apiKey;
    this.permissions = permissions || [];
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
   * @param {Object} data - An object containing the fields to update
   * @param {string} [data.name]
   * @param {string} [data.email]
   * @param {string} [data.licensePlate]
   * @param {string} [data.phoneNumber]
   * @param {string} [data.userType]
   */
  updateProfile(data) {
    const updatableFields = ['name', 'email', 'licensePlate', 'phoneNumber', 'userType'];

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
}

module.exports = User;
