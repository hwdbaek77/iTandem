export const lots = ["Taper", "Coldwater", "Hacienda", "St Michael", "Hamilton"];

export const spotsByLot = {
  Taper: [
    { id: "taper-a12", number: "A12", distanceMiles: 0.1, type: "Premium", isAvailable: true },
    { id: "taper-b15", number: "B15", distanceMiles: 0.2, type: "Standard", isAvailable: true },
    { id: "taper-c20", number: "C20", distanceMiles: 0.3, type: "Compact", isAvailable: false },
    { id: "taper-d04", number: "D04", distanceMiles: 0.4, type: "Standard", isAvailable: true },
  ],
  Coldwater: [
    { id: "coldwater-a03", number: "A03", distanceMiles: 0.2, type: "Standard", isAvailable: true },
    { id: "coldwater-b09", number: "B09", distanceMiles: 0.3, type: "Compact", isAvailable: false },
    { id: "coldwater-c11", number: "C11", distanceMiles: 0.4, type: "Standard", isAvailable: true },
    { id: "coldwater-d14", number: "D14", distanceMiles: 0.5, type: "Premium", isAvailable: true },
  ],
  Hacienda: [
    { id: "hacienda-a01", number: "A01", distanceMiles: 0.3, type: "Premium", isAvailable: false },
    { id: "hacienda-b06", number: "B06", distanceMiles: 0.4, type: "Standard", isAvailable: true },
    { id: "hacienda-c17", number: "C17", distanceMiles: 0.5, type: "Compact", isAvailable: true },
    { id: "hacienda-d22", number: "D22", distanceMiles: 0.6, type: "Standard", isAvailable: false },
  ],
  "St Michael": [
    { id: "stmichael-a07", number: "A07", distanceMiles: 0.4, type: "Standard", isAvailable: true },
    { id: "stmichael-b12", number: "B12", distanceMiles: 0.5, type: "Compact", isAvailable: true },
    { id: "stmichael-c19", number: "C19", distanceMiles: 0.6, type: "Premium", isAvailable: false },
    { id: "stmichael-d24", number: "D24", distanceMiles: 0.7, type: "Standard", isAvailable: true },
  ],
  Hamilton: [
    { id: "hamilton-a02", number: "A02", distanceMiles: 0.5, type: "Standard", isAvailable: true },
    { id: "hamilton-b10", number: "B10", distanceMiles: 0.6, type: "Compact", isAvailable: false },
    { id: "hamilton-c16", number: "C16", distanceMiles: 0.7, type: "Premium", isAvailable: true },
    { id: "hamilton-d21", number: "D21", distanceMiles: 0.8, type: "Standard", isAvailable: true },
  ],
};

export function getSpotsForLot(lot) {
  return spotsByLot[lot] || [];
}

export function getSpotById(spotId) {
  for (const lot of lots) {
    const spot = spotsByLot[lot].find((item) => item.id === spotId);
    if (spot) {
      return { ...spot, lot };
    }
  }
  return null;
}
