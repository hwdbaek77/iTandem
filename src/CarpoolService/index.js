/**
 * CarpoolService Module — Public API
 *
 * Import everything from here:
 *   const { CarpoolService, CarpoolProfile, ... } = require('./src/CarpoolService');
 */

// Models
const CarpoolProfile = require('./models/CarpoolProfile');
const CarpoolGroup = require('./models/CarpoolGroup');
const CarpoolRequest = require('./models/CarpoolRequest');
const CarpoolMatch = require('./models/CarpoolMatch');
const GasEstimate = require('./models/GasEstimate');

// Services
const CarpoolService = require('./services/CarpoolService');
const CarpoolCompatibilityEngine = require('./services/CarpoolCompatibilityEngine');
const GasEstimator = require('./services/GasEstimator');

// Constants
const constants = require('./utils/constants');

module.exports = {
  // Models
  CarpoolProfile,
  CarpoolGroup,
  CarpoolRequest,
  CarpoolMatch,
  GasEstimate,

  // Services
  CarpoolService,
  CarpoolCompatibilityEngine,
  GasEstimator,

  // Constants
  ...constants,
};
