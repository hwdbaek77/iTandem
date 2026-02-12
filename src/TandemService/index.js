/**
 * TandemService Module — Public API
 *
 * Import everything from here:
 *   const { TandemService, TandemProfile, ... } = require('./src/TandemService');
 */

// Models
const TandemProfile = require('./models/TandemProfile');
const TandemPairing = require('./models/TandemPairing');
const TandemRequest = require('./models/TandemRequest');
const TandemMatch = require('./models/TandemMatch');
const Emote = require('./models/Emote');

// Services
const TandemService = require('./services/TandemService');
const TandemCompatibilityEngine = require('./services/TandemCompatibilityEngine');

// Constants
const constants = require('./utils/constants');

module.exports = {
  // Models
  TandemProfile,
  TandemPairing,
  TandemRequest,
  TandemMatch,
  Emote,

  // Services
  TandemService,
  TandemCompatibilityEngine,

  // Constants
  ...constants,
};
