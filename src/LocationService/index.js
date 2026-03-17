/**
 * LocationService Module — Public API
 *
 * Import everything from here:
 *   const { LocationService, GeofenceEngine, ... } = require('./src/LocationService');
 */

// Models
const UserLocation = require('./models/UserLocation');
const GeofenceZone = require('./models/GeofenceZone');

// Services
const LocationService = require('./services/LocationService');
const GeofenceEngine = require('./services/GeofenceEngine');
const EtaCalculator = require('./services/EtaCalculator');
const RouteOverlapService = require('./services/RouteOverlapService');

// Constants
const constants = require('./utils/constants');

module.exports = {
  // Models
  UserLocation,
  GeofenceZone,

  // Services
  LocationService,
  GeofenceEngine,
  EtaCalculator,
  RouteOverlapService,

  // Constants
  ...constants,
};
