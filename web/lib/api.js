/**
 * Centralized API client for the iTandem backend.
 * Automatically attaches Firebase Auth tokens to all requests.
 */

import { auth } from "./firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://us-central1-itandem-api.cloudfunctions.net/apiv2";

/**
 * Make an authenticated API request.
 * Automatically retrieves and attaches the current user's ID token.
 */
async function apiRequest(path, options = {}) {
  const user = auth.currentUser;
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
  updateMe: (data) => apiRequest("/users/me", { method: "PUT", body: JSON.stringify(data) }),

  // Schedules
  uploadSchedule: (file) => {
    const formData = new FormData();
    formData.append("schedule", file);
    return apiRequest("/schedules/upload", { method: "POST", body: formData });
  },
  getMySchedule: () => apiRequest("/schedules/me"),
  compareSchedule: (userId) => apiRequest(`/schedules/compare/${userId}`, { method: "POST" }),
  getRankedMatches: () => apiRequest("/schedules/matches/ranked"),

  // Spots
  getSpots: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/spots${query ? `?${query}` : ""}`);
  },
  getLots: () => apiRequest("/spots/lots"),
  getLotSpots: (lotName) => apiRequest(`/spots/lot/${encodeURIComponent(lotName)}`),
  getSpot: (spotId) => apiRequest(`/spots/${spotId}`),

  // Rentals
  createRental: (data) => apiRequest("/rentals", { method: "POST", body: JSON.stringify(data) }),
  getMyRentals: () => apiRequest("/rentals/me"),
  getRental: (rentalId) => apiRequest(`/rentals/${rentalId}`),
  cancelRental: (rentalId) => apiRequest(`/rentals/${rentalId}/cancel`, { method: "PUT" }),

  // Canvas
  getCanvasCourses: () => apiRequest("/canvas/courses"),
  getCanvasSchedule: () => apiRequest("/canvas/schedule"),

  // Health
  getHealth: () => apiRequest("/health"),
};
