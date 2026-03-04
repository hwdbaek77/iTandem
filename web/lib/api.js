/**
 * Centralized API client for the iTandem backend.
 * Automatically attaches Firebase Auth tokens to all requests.
 */

import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://apiv2-hnx3gtxgia-uc.a.run.app";

/**
 * Wait for Firebase Auth to finish restoring the session.
 * On first load, auth.currentUser is null until onAuthStateChanged fires.
 * Returns the current user (or null if not logged in).
 */
let authReady = null;
function waitForAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authReady) return authReady;
  authReady = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      authReady = null;
      resolve(user);
    });
  });
  return authReady;
}

/**
 * Make an authenticated API request.
 * Waits for Firebase Auth to initialize, then attaches the ID token.
 */
async function apiRequest(path, options = {}) {
  const user = auth.currentUser || await waitForAuth();
  const headers = {
    ...options.headers,
  };

  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Request failed — server returned ${res.status} (non-JSON response)`);
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  signup: (data) => apiRequest("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => apiRequest("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  // Users
  getMe: () => apiRequest("/users/me"),
  updateMe: (data) => {
    const payload = { ...data };
    if (payload.phone !== undefined) {
      payload.phoneNumber = payload.phone;
      delete payload.phone;
    }
    if (payload.spot !== undefined) {
      payload.parkingSpot = payload.spot;
      delete payload.spot;
    }
    // spotLot, isListedForRent, rentDays, hasSpot, doesTandem, doesCarpool passed through directly
    return apiRequest("/users/me", { method: "PUT", body: JSON.stringify(payload) });
  },
  getUser: (userId) => apiRequest(`/users/${userId}`),

  // Schedules
  uploadSchedule: (file) => {
    const formData = new FormData();
    formData.append("schedule", file);
    return apiRequest("/schedules/upload", { method: "POST", body: formData });
  },
  getMySchedule: () => apiRequest("/schedules/me"),
  compareSchedule: (userId) => apiRequest(`/schedules/compare/${userId}`, { method: "POST" }),
  getRankedMatches: (type = "tandem") =>
    apiRequest(`/schedules/matches/ranked${type ? `?type=${encodeURIComponent(type)}` : ""}`),

  // Spots
  getSpots: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/spots${query ? `?${query}` : ""}`);
  },
  getLots: () => apiRequest("/spots/lots"),
  getLotSpots: (lotName) => apiRequest(`/spots/lot/${encodeURIComponent(lotName)}`),
  getSpot: (spotId) => apiRequest(`/spots/${spotId}`),
  seedSpots: () => apiRequest("/spots/seed", { method: "POST" }),

  // Rentals
  createRental: (data) => apiRequest("/rentals", { method: "POST", body: JSON.stringify(data) }),
  getMyRentals: () => apiRequest("/rentals/me"),
  getRental: (rentalId) => apiRequest(`/rentals/${rentalId}`),
  cancelRental: (rentalId) => apiRequest(`/rentals/${rentalId}/cancel`, { method: "PUT" }),

  // Matches
  sendMatchRequest: (targetUserId, type) =>
    apiRequest("/matches/request", { method: "POST", body: JSON.stringify({ targetUserId, type }) }),
  acceptMatch: (matchId) => apiRequest(`/matches/${matchId}/accept`, { method: "PUT" }),
  declineMatch: (matchId) => apiRequest(`/matches/${matchId}/decline`, { method: "PUT" }),
  unmatch: (matchId) => apiRequest(`/matches/${matchId}/unmatch`, { method: "PUT" }),
  getMyMatches: () => apiRequest("/matches/me"),
  sendMessage: (matchId, text) =>
    apiRequest(`/matches/${matchId}/message`, { method: "POST", body: JSON.stringify({ text }) }),
  getMessages: (matchId) => apiRequest(`/matches/${matchId}/messages`),

  // Canvas
  linkCanvasToken: (token) => apiRequest("/auth/canvas-token", { method: "POST", body: JSON.stringify({ canvasAccessToken: token }) }),
  getCanvasStatus: () => apiRequest("/auth/canvas-token"),
  getCanvasCourses: () => apiRequest("/canvas/courses"),
  getCanvasSchedule: () => apiRequest("/canvas/schedule"),

  // Health
  getHealth: () => apiRequest("/health"),
};
