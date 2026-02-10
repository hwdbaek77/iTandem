/**
 * iTandem — Public API
 *
 * Import everything from here:
 *   const { RentalService, CarpoolService, TandemService, ParkingSpot, ... } = require('./src');
 *
 * Or import individual modules:
 *   const rental  = require('./src/RentalService');
 *   const carpool = require('./src/CarpoolService');
 *   const tandem  = require('./src/TandemService');
 */

// Re-export everything from all service modules
module.exports = {
  ...require('./RentalService'),
  ...require('./CarpoolService'),
  ...require('./TandemService'),
};
