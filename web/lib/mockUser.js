// Mock user data for development.
// Toggle any field to null to test the "unmatched" state on the home dashboard.

export const mockUser = {
  name: "Hannah",
  classYear: "'27",

  // Set to null to see the "Find Tandem Match" prompt instead.
  tandemPartner: {
    name: "Sarah K.",
    spot: "B15, Taper Lot",
  },

  // Set to null to see the "Find Carpool Partner" prompt instead.
  carpoolPartner: null,

  // Set to null to see the "Find Parking" prompt instead.
  parkingSpot: {
    lot: "Taper",
    number: "A12",
    type: "Premium",
  },
};
