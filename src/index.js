/**
 * iTandem — Public API
 *
 * Import everything from here:
 *   const { RentalService, CarpoolService, ParkingSpot, ... } = require('./src');
 *
 * Or import individual modules:
 *   const rental  = require('./src/RentalService');
 *   const carpool = require('./src/CarpoolService');
 */

// Re-export everything from both service modules
module.exports = {
  ...require('./RentalService'),
  ...require('./CarpoolService'),
};
