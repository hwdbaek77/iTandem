/**
 * RentalService Module — Public API
 *
 * Import everything from here:
 *   const { RentalService, ParkingSpot, ... } = require('./src/RentalService');
 */

// Models
const ParkingSpot = require('./models/ParkingSpot');
const SpotOwnership = require('./models/SpotOwnership');
const SpotRental = require('./models/SpotRental');
const Transaction = require('./models/Transaction');
const Penalty = require('./models/Penalty');
const Report = require('./models/Report');

// Services
const RentalService = require('./services/RentalService');
const PricingEngine = require('./services/PricingEngine');

// Constants
const constants = require('./utils/constants');

module.exports = {
  // Models
  ParkingSpot,
  SpotOwnership,
  SpotRental,
  Transaction,
  Penalty,
  Report,

  // Services
  RentalService,
  PricingEngine,

  // Constants
  ...constants,
};
