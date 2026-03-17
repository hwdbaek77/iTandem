/**
 * testLocationService.js
 *
 * Unit and integration tests for the LocationService module.
 * Run: node test/testLocationService.js
 *
 * For ETA/geocode tests (optional): set GOOGLE_MAPS_API_KEY in .env.local
 * or pass it as an env var. Without it, those tests are skipped.
 */

const path = require('path');

// Load .env.local from project root if it exists
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  require('fs').readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
} catch {
  // .env.local not found — use existing env
}

const {
  GeofenceEngine,
  LocationService,
  EtaCalculator,
  RouteOverlapService,
  UserLocation,
  GeofenceZone,
  SCHOOL_COORDINATES,
  LOCATION_STATUS,
  LOCATION_SOURCE,
} = require('../src/LocationService');

// ── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual})`);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

async function runTests() {

// ── GeofenceEngine ─────────────────────────────────────────────────────────

section('GeofenceEngine.distanceMeters');
{
  const a = { lat: 34.14, lng: -118.43 };
  const b = { lat: 34.15, lng: -118.43 };
  const dist = GeofenceEngine.distanceMeters(a, b);
  assertApprox(dist, 1112, 50, '~1.1 km between 0.01° lat');
}

section('GeofenceEngine.isInsideZone');
{
  const zone = GeofenceZone.createSchoolZone();
  const inside = { lat: SCHOOL_COORDINATES.lat, lng: SCHOOL_COORDINATES.lng };
  const outside = { lat: 34.5, lng: -118.0 };
  assert(GeofenceEngine.isInsideZone(inside, zone), 'Point at center is inside');
  assert(!GeofenceEngine.isInsideZone(outside, zone), 'Point far away is outside');
}

section('GeofenceEngine.detectCurrentZone');
{
  const zones = [
    GeofenceZone.createSchoolZone(),
    GeofenceZone.createHomeZone('u1', { lat: 34.14, lng: -118.43 }),
  ];
  const atSchool = GeofenceEngine.detectCurrentZone(SCHOOL_COORDINATES, zones);
  const atHome = GeofenceEngine.detectCurrentZone({ lat: 34.14, lng: -118.43 }, zones);
  const nowhere = GeofenceEngine.detectCurrentZone({ lat: 35, lng: -120 }, zones);
  assertEq(atSchool?.zoneType, 'school', 'Detects school zone');
  assertEq(atHome?.zoneType, 'home', 'Detects home zone');
  assertEq(nowhere, null, 'Outside all zones returns null');
}

section('GeofenceEngine.evaluateTransition');
{
  const zones = [
    GeofenceZone.createSchoolZone(),
    GeofenceZone.createHomeZone('u1', { lat: 34.14, lng: -118.43 }),
  ];

  // At home → left home
  const leftHome = GeofenceEngine.evaluateTransition({
    coordinates: { lat: 34.2, lng: -118.5 },
    zones,
    previousStatus: LOCATION_STATUS.AT_HOME,
    arrivedAtSchoolAt: null,
  });
  assert(leftHome.events.includes('left_home'), 'Leaving home triggers left_home');
  assertEq(leftHome.status, LOCATION_STATUS.EN_ROUTE_TO_SCHOOL, 'Status becomes en_route');

  // At school → left school (with buffer)
  const leftSchool = GeofenceEngine.evaluateTransition({
    coordinates: { lat: 34.2, lng: -118.5 },
    zones,
    previousStatus: LOCATION_STATUS.AT_SCHOOL,
    arrivedAtSchoolAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
  });
  assert(leftSchool.events.includes('left_school'), 'Leaving school after buffer triggers');
  assertEq(leftSchool.status, LOCATION_STATUS.LEFT_SCHOOL, 'Status becomes left_school');

  // At school but buffer not met → stays at school
  const tooSoon = GeofenceEngine.evaluateTransition({
    coordinates: { lat: 34.2, lng: -118.5 },
    zones,
    previousStatus: LOCATION_STATUS.AT_SCHOOL,
    arrivedAtSchoolAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
  });
  assertEq(tooSoon.status, LOCATION_STATUS.AT_SCHOOL, 'Stays at_school if buffer not met');
}

// ── UserLocation & GeofenceZone models ───────────────────────────────────────

section('UserLocation model');
{
  const loc = new UserLocation({
    userId: 'u1',
    coordinates: { lat: 34.14, lng: -118.43 },
    status: LOCATION_STATUS.AT_SCHOOL,
    source: LOCATION_SOURCE.MANUAL,
  });
  assert(loc.hasValidCoordinates(), 'Valid coordinates');
  assert(loc.isAtSchool(), 'isAtSchool');
  assert(!loc.isEnRoute(), 'not en route');
  assert(loc.isFresh(15), 'Fresh within 15 min');
}

section('GeofenceZone factories');
{
  const home = GeofenceZone.createHomeZone('u1', { lat: 34, lng: -118 });
  const school = GeofenceZone.createSchoolZone();
  assertEq(home.zoneType, 'home', 'Home zone type');
  assertEq(home.zoneId, 'home_u1', 'Home zone id');
  assertEq(school.zoneType, 'school', 'School zone type');
  assertEq(school.zoneId, 'school', 'School zone id');
}

// ── RouteOverlapService.decodePolyline ──────────────────────────────────────

section('RouteOverlapService.decodePolyline');
{
  // Google encoded polyline for a short path
  const encoded = 'u{~iF~ps|U_ulLnnqC_mqNvxq`@';
  const points = RouteOverlapService.decodePolyline(encoded);
  assert(points.length > 0, 'Decodes to non-empty points');
  assert(typeof points[0].lat === 'number' && typeof points[0].lng === 'number', 'Points have lat/lng');
  assertEq(RouteOverlapService.decodePolyline('').length, 0, 'Empty string returns []');
}

// ── LocationService (no API) ────────────────────────────────────────────────

section('LocationService zone setup & geofence');
{
  const svc = new LocationService({ apiKey: null });
  svc.setupUserZones('u1', { lat: 34.14, lng: -118.43 });
  const zones = svc.getUserZones('u1');
  assert(zones.length >= 2, 'Has school + home zones');

  const result = await svc.updateLocation({
    userId: 'u1',
    coordinates: SCHOOL_COORDINATES,
    source: LOCATION_SOURCE.MANUAL,
    carpoolMemberIds: [],
  });

  assert(result.location.status === LOCATION_STATUS.AT_SCHOOL, 'Detects at school');
  assert(result.events.includes('entered_school'), 'Fires entered_school event');
}

section('LocationService getUsersOnCampus');
{
  const svc = new LocationService({ apiKey: null });
  svc.setupUserZones('u1', SCHOOL_COORDINATES);
  svc.setupUserZones('u2', { lat: 34.2, lng: -118.5 });
  await svc.updateLocation({ userId: 'u1', coordinates: SCHOOL_COORDINATES, carpoolMemberIds: [] });
  await svc.updateLocation({ userId: 'u2', coordinates: SCHOOL_COORDINATES, carpoolMemberIds: [] });

  const onCampus = svc.getUsersOnCampus(15);
  assert(onCampus.length >= 2, 'Both users on campus');
}

section('LocationService findRideHome');
{
  const svc = new LocationService({ apiKey: null });
  svc.setupUserZones('alex', { lat: 34.2, lng: -118.5 });
  svc.setupUserZones('bob', SCHOOL_COORDINATES);
  await svc.updateLocation({ userId: 'alex', coordinates: { lat: 34.3, lng: -118.4 }, carpoolMemberIds: [] });
  await svc.updateLocation({ userId: 'bob', coordinates: SCHOOL_COORDINATES, carpoolMemberIds: [] });

  const { onCampusUsers, notification } = svc.findRideHome({ requesterId: 'alex' });
  assert(onCampusUsers.some((u) => u.userId === 'bob'), 'Bob is on campus');
  assert(!onCampusUsers.some((u) => u.userId === 'alex'), 'Alex (requester) not in list');
  assertEq(notification.type, 'ride_home_request', 'Notification type');
}

// ── EtaCalculator & Geocoding (requires API key) ────────────────────────────

const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

section('EtaCalculator (optional, requires GOOGLE_MAPS_API_KEY)');
if (apiKey) {
  const calc = new EtaCalculator({ apiKey });
  const result = await calc.computeRoute(
    { lat: 34.14, lng: -118.43 },
    SCHOOL_COORDINATES,
  );
  assert(result.etaMinutes > 0, 'ETA returned');
  assert(result.distanceMeters > 0, 'Distance returned');
  assert(typeof result.polyline === 'string', 'Polyline returned');

  const geocoded = await calc.geocodeAddress('3700 Coldwater Canyon Ave, Studio City, CA');
  assert(geocoded.lat && geocoded.lng, 'Geocode returns coordinates');
  assert(geocoded.formattedAddress, 'Geocode returns formatted address');
} else {
  console.log('  (skipped — no GOOGLE_MAPS_API_KEY in .env.local)');
}

section('LocationService.getEta (optional)');
if (apiKey) {
  const svc = new LocationService({ apiKey });
  const eta = await svc.getEta({ lat: 34.14, lng: -118.43 }, SCHOOL_COORDINATES);
  assert(eta.etaMinutes > 0, 'getEta returns minutes');
} else {
  console.log('  (skipped — no API key)');
}

section('RouteOverlapService.checkRouteOverlap (optional)');
if (apiKey) {
  const calc = new EtaCalculator({ apiKey });
  const overlapSvc = new RouteOverlapService({ etaCalculator: calc });
  const { onSameRoute, overlapFraction } = await overlapSvc.checkRouteOverlap(
    { lat: 34.14, lng: -118.43 },
    { lat: 34.15, lng: -118.42 },
  );
  assert(typeof onSameRoute === 'boolean', 'Returns onSameRoute boolean');
  assert(overlapFraction >= 0 && overlapFraction <= 1, 'Overlap fraction in [0,1]');
} else {
  console.log('  (skipped — no API key)');
}

// ── Summary ─────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(50));
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('═'.repeat(50));
}

runTests().then(() => {
  process.exit(failed > 0 ? 1 : 0);
}).catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
