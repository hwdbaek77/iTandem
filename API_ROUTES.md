# iTandem API Routes

All routes are prefixed with `/api`. Authenticated routes require a valid session token in the `Authorization: Bearer <token>` header. Responses use standard HTTP status codes and return JSON.

---

## Authentication

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/auth/login` | Initiate OAuth login via Didax (school SSO) | No |
| `GET` | `/api/auth/callback` | OAuth callback — exchanges code for session token | No |
| `POST` | `/api/auth/verify-email` | Verify school email address | No |
| `POST` | `/api/auth/refresh` | Refresh an expired session token | Yes |
| `POST` | `/api/auth/logout` | Invalidate current session | Yes |

### Details

**POST `/api/auth/login`**
```json
// Request
{ "redirect_uri": "https://itandem.app/auth/callback" }

// Response 200
{ "authorization_url": "https://didax.hw.com/oauth/authorize?client_id=...&redirect_uri=..." }
```

**GET `/api/auth/callback`**
```
Query: ?code=<oauth_code>&state=<csrf_state>

Response 200
{
  "token": "eyJhbGci...",
  "user": { "user_id": "uuid", "first_name": "Hannah", "last_name": "..." }
}
```

---

## Users

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/users/me` | Get current user's full profile | Yes |
| `PUT` | `/api/users/me` | Update current user's profile | Yes |
| `GET` | `/api/users/:userId` | Get another user's public profile | Yes |

### Details

**GET `/api/users/me`**
```json
// Response 200
{
  "user_id": "uuid",
  "school_email": "hchen@hw.com",
  "first_name": "Hannah",
  "last_name": "Chen",
  "grade_level": "junior",
  "phone_number": "310-555-0100",
  "profile_photo_url": "https://...",
  "bio": "...",
  "music_preferences": "indie, pop",
  "account_status": "active",
  "created_at": "2026-01-15T00:00:00Z"
}
```

**PUT `/api/users/me`**
```json
// Request (all fields optional)
{
  "phone_number": "310-555-0199",
  "bio": "Updated bio",
  "music_preferences": "jazz, lo-fi"
}

// Response 200 — returns the updated user object
```

---

## Vehicles

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/vehicles` | Register a vehicle | Yes |
| `GET` | `/api/vehicles/me` | Get current user's vehicles | Yes |
| `PUT` | `/api/vehicles/:vehicleId` | Update a vehicle | Yes |
| `DELETE` | `/api/vehicles/:vehicleId` | Remove a vehicle | Yes |

### Details

**POST `/api/vehicles`**
```json
// Request
{
  "license_plate": "8ABC123",
  "make": "Toyota",
  "model": "Camry",
  "year": 2022,
  "color": "Silver",
  "vehicle_size": "standard"
}

// Response 201
{ "vehicle_id": "uuid", "is_verified": false, ... }
```

---

## Schedules

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/schedules/me` | Get current user's weekly schedule | Yes |
| `PUT` | `/api/schedules/me` | Manually update schedule | Yes |
| `POST` | `/api/schedules/sync` | Sync schedule from Didax school API | Yes |

### Details

**GET `/api/schedules/me`**
```json
// Response 200
{
  "schedule_id": "uuid",
  "days": [
    {
      "day_of_week": "Monday",
      "arrival_time": "07:45",
      "departure_time": "15:30",
      "has_lunch_off_campus": false,
      "extracurricular_end_time": "17:00"
    }
    // ... Tuesday–Friday
  ],
  "is_manually_overridden": false,
  "last_synced_at": "2026-02-10T08:00:00Z"
}
```

**POST `/api/schedules/sync`**
```json
// Response 200
{ "message": "Schedule synced from Didax", "schedule": { ... } }

// Response 502 (Didax unavailable)
{ "error": "school_api_unavailable", "message": "Could not reach Didax. Try again later." }
```

---

## Tandem Matching

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/tandem/matches` | Get ranked list of compatible tandem partners | Yes |
| `POST` | `/api/tandem/request` | Send a tandem pairing request | Yes |
| `PUT` | `/api/tandem/:pairingId/accept` | Accept a pending tandem request | Yes |
| `PUT` | `/api/tandem/:pairingId/decline` | Decline a pending tandem request | Yes |
| `GET` | `/api/tandem/current` | Get current active tandem pairing | Yes |
| `DELETE` | `/api/tandem/:pairingId` | End an active tandem pairing | Yes |

### Details

**GET `/api/tandem/matches`**
```json
// Query: ?limit=20&offset=0

// Response 200
{
  "matches": [
    {
      "user_id": "uuid",
      "first_name": "Sarah",
      "last_name": "K.",
      "grade_level": "junior",
      "compatibility_score": 87,
      "score_breakdown": {
        "schedule_overlap": 36,
        "grade_compatibility": 20,
        "arrival_compatibility": 16,
        "extracurricular_alignment": 8,
        "lunch_habits": 7
      },
      "profile_photo_url": "https://..."
    }
  ],
  "total": 42
}
```

**POST `/api/tandem/request`**
```json
// Request
{ "target_user_id": "uuid", "spot_id": "uuid" }

// Response 201
{ "pairing_id": "uuid", "status": "pending" }
```

**GET `/api/tandem/current`**
```json
// Response 200
{
  "pairing_id": "uuid",
  "partner": { "user_id": "uuid", "first_name": "Sarah", "last_name": "K.", ... },
  "spot": { "spot_id": "uuid", "lot_name": "Taper", "spot_number": "B15" },
  "compatibility_score": 87,
  "status": "active",
  "start_date": "2026-01-20"
}

// Response 404 (no active pairing)
{ "error": "no_active_pairing" }
```

---

## Carpool Matching

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/carpool/matches` | Get ranked list of compatible carpool partners | Yes |
| `POST` | `/api/carpool/create` | Create a new carpool group (as driver) | Yes |
| `POST` | `/api/carpool/:carpoolId/join` | Request to join an existing carpool group | Yes |
| `PUT` | `/api/carpool/:carpoolId/accept/:userId` | Accept a join request (driver only) | Yes |
| `PUT` | `/api/carpool/:carpoolId/decline/:userId` | Decline a join request (driver only) | Yes |
| `GET` | `/api/carpool/current` | Get current active carpool group | Yes |
| `DELETE` | `/api/carpool/:carpoolId/leave` | Leave a carpool group | Yes |
| `POST` | `/api/carpool/:carpoolId/status` | Broadcast status ("I'm leaving" / "I'm here") | Yes |

### Details

**GET `/api/carpool/matches`**
```json
// Query: ?limit=20&offset=0

// Response 200
{
  "matches": [
    {
      "user_id": "uuid",
      "first_name": "Daniel",
      "last_name": "M.",
      "grade_level": "senior",
      "compatibility_score": 72,
      "score_breakdown": {
        "geographic_proximity": 30,
        "schedule_alignment": 25,
        "grade_priority": 15,
        "personal_compatibility": 2
      },
      "distance_miles": 1.3,
      "bio": "Likes lo-fi and podcasts",
      "profile_photo_url": "https://..."
    }
  ],
  "total": 28
}
```

**POST `/api/carpool/:carpoolId/status`**
```json
// Request
{ "status": "leaving" }   // "leaving" | "arrived" | "delayed"

// Response 200
{ "message": "Status broadcast to group" }
```

---

## Parking Spots

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/spots` | List all parking spots (with filters) | Yes |
| `GET` | `/api/spots/:spotId` | Get details for a specific spot | Yes |
| `GET` | `/api/spots/map/:lotName` | Get map data + spot statuses for a lot | Yes |
| `GET` | `/api/spots/mine` | Get spots owned by current user | Yes |

### Details

**GET `/api/spots`**
```json
// Query: ?lot=Taper&type=tandem&available=true

// Response 200
{
  "spots": [
    {
      "spot_id": "uuid",
      "lot_name": "Taper",
      "spot_number": "B15",
      "spot_type": "tandem",
      "is_compact": false,
      "distance_to_campus": 120,
      "coordinates": { "lat": 34.1234, "lng": -118.5678 },
      "is_available": true
    }
  ],
  "total": 156
}
```

**GET `/api/spots/map/:lotName`**
```json
// Response 200
{
  "lot_name": "Taper",
  "spots": [
    {
      "spot_id": "uuid",
      "spot_number": "A12",
      "coordinates": { "lat": 34.1234, "lng": -118.5678 },
      "status": "occupied",
      "spot_type": "single"
    }
  ],
  "lot_boundary": { ... }
}
```

---

## Spot Rentals

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/rentals/available` | Get spots available for rent on a date | Yes |
| `POST` | `/api/rentals/list` | List your spot as available for rent | Yes |
| `GET` | `/api/rentals/my-listings` | Get your current rental listings | Yes |
| `PUT` | `/api/rentals/listings/:listingId` | Update a listing (price, dates) | Yes |
| `DELETE` | `/api/rentals/listings/:listingId` | Remove a listing | Yes |
| `POST` | `/api/rentals/request` | Request to rent a spot | Yes |
| `GET` | `/api/rentals/my-rentals` | Get your active/past rentals (as renter) | Yes |
| `PUT` | `/api/rentals/:rentalId/confirm` | Owner confirms a rental request | Yes |
| `PUT` | `/api/rentals/:rentalId/reject` | Owner rejects a rental request | Yes |
| `DELETE` | `/api/rentals/:rentalId/cancel` | Cancel a rental (refund rules apply) | Yes |
| `POST` | `/api/rentals/:rentalId/report` | Report an issue with a rental | Yes |

### Details

**GET `/api/rentals/available`**
```json
// Query: ?date=2026-02-15&lot=Taper&max_price=1500

// Response 200
{
  "spots": [
    {
      "rental_listing_id": "uuid",
      "spot": { "spot_id": "uuid", "lot_name": "Taper", "spot_number": "C4", "is_compact": false },
      "owner": { "user_id": "uuid", "first_name": "Max" },
      "price_cents": 800,
      "available_dates": ["2026-02-15", "2026-02-16"]
    }
  ]
}
```

**POST `/api/rentals/request`**
```json
// Request
{
  "rental_listing_id": "uuid",
  "rental_date": "2026-02-15"
}

// Response 201
{
  "rental_id": "uuid",
  "status": "pending",
  "payment_intent_id": "pi_..."
}
```

**DELETE `/api/rentals/:rentalId/cancel`**
```json
// Response 200
{
  "rental_id": "uuid",
  "status": "cancelled",
  "refund": {
    "amount_cents": 800,
    "type": "full"           // "full" if day before, "partial" or "none" + fine if day-of
  },
  "penalty_applied": false
}
```

---

## Payments

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/payments/setup-intent` | Create Stripe setup intent for saving a card | Yes |
| `GET` | `/api/payments/methods` | List saved payment methods | Yes |
| `DELETE` | `/api/payments/methods/:methodId` | Remove a saved payment method | Yes |
| `GET` | `/api/payments/history` | Get transaction history | Yes |
| `GET` | `/api/payments/balance` | Get payout balance (for spot owners) | Yes |
| `POST` | `/api/payments/payout` | Request payout of earnings | Yes |

### Details

**GET `/api/payments/history`**
```json
// Query: ?limit=20&offset=0

// Response 200
{
  "transactions": [
    {
      "transaction_id": "uuid",
      "type": "rental_payment",
      "amount_cents": 800,
      "status": "completed",
      "description": "Spot C4 rental — Feb 15",
      "created_at": "2026-02-14T18:00:00Z"
    }
  ],
  "total": 5
}
```

---

## Messaging

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/messages/conversations` | List all conversations | Yes |
| `GET` | `/api/messages/:conversationId` | Get messages in a conversation | Yes |
| `POST` | `/api/messages/:conversationId/send` | Send a message or emote | Yes |
| `PUT` | `/api/messages/:conversationId/read` | Mark conversation as read | Yes |

### WebSocket Events (Socket.io)

| Event | Direction | Description |
|-------|-----------|-------------|
| `message:new` | Server -> Client | New message received |
| `message:read` | Server -> Client | Conversation marked as read |
| `carpool:status` | Server -> Client | Carpool partner status update |
| `typing:start` | Client -> Server | User started typing |
| `typing:stop` | Client -> Server | User stopped typing |

### Details

**POST `/api/messages/:conversationId/send`**
```json
// Request
{
  "message_type": "emote",         // "text" | "emote" | "system"
  "content": "move_your_car"       // emote key or text string
}

// Available emotes: "move_your_car", "leaving_soon", "running_late",
//                   "im_here", "thanks", "on_my_way"

// Response 201
{
  "message_id": "uuid",
  "sender_user_id": "uuid",
  "message_type": "emote",
  "content": "move_your_car",
  "created_at": "2026-02-12T14:30:00Z"
}
```

---

## Notifications

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/notifications` | Get user's notifications | Yes |
| `PUT` | `/api/notifications/:notificationId/read` | Mark a notification as read | Yes |
| `PUT` | `/api/notifications/read-all` | Mark all notifications as read | Yes |
| `GET` | `/api/notifications/unread-count` | Get count of unread notifications | Yes |

### Details

**GET `/api/notifications`**
```json
// Query: ?limit=20&offset=0&unread_only=true

// Response 200
{
  "notifications": [
    {
      "notification_id": "uuid",
      "type": "match_found",
      "title": "New Tandem Match!",
      "message": "Sarah K. is a 87% match for your tandem spot.",
      "related_entity_id": "uuid",
      "is_read": false,
      "created_at": "2026-02-12T10:00:00Z"
    }
  ],
  "total": 12,
  "unread_count": 3
}
```

---

## Reports & Disputes

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/api/reports` | File a report (with photo evidence) | Yes |
| `GET` | `/api/reports/mine` | Get reports you've filed | Yes |
| `GET` | `/api/reports/:reportId` | Get report details | Yes |

### Details

**POST `/api/reports`**
```json
// Request (multipart/form-data)
{
  "reported_user_id": "uuid",
  "rental_id": "uuid",                     // optional
  "report_type": "blocked_spot",           // "blocked_spot" | "damage" | "harassment" | "scam"
  "description": "Someone is parked in my rented spot",
  "photos": [File, File]                   // up to 5 photos
}

// Response 201
{ "report_id": "uuid", "status": "pending" }
```

---

## Admin

> Admin routes require `role: admin` on the user's session.

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/admin/reports` | List all pending reports | Admin |
| `GET` | `/api/admin/reports/:reportId` | Get full report details | Admin |
| `PUT` | `/api/admin/reports/:reportId/resolve` | Resolve a report | Admin |
| `POST` | `/api/admin/penalties` | Apply a penalty to a user | Admin |
| `GET` | `/api/admin/penalties` | List all penalties | Admin |
| `PUT` | `/api/admin/penalties/:penaltyId/waive` | Waive a penalty | Admin |
| `GET` | `/api/admin/users` | List/search all users | Admin |
| `PUT` | `/api/admin/users/:userId/status` | Suspend or ban a user | Admin |
| `GET` | `/api/admin/analytics` | Platform analytics dashboard data | Admin |
| `GET` | `/api/admin/analytics/revenue` | Revenue breakdown | Admin |
| `GET` | `/api/admin/analytics/usage` | Usage metrics (matches, rentals) | Admin |

### Details

**PUT `/api/admin/reports/:reportId/resolve`**
```json
// Request
{
  "resolution": "penalty_applied",    // "penalty_applied" | "dismissed" | "warning_issued"
  "admin_notes": "Confirmed blocked spot via photo evidence",
  "penalty": {
    "user_id": "uuid",
    "offense_type": "spot_blocking",
    "amount_cents": 2000
  }
}

// Response 200
{ "report_id": "uuid", "status": "resolved" }
```

**GET `/api/admin/analytics`**
```json
// Response 200
{
  "total_users": 312,
  "active_tandem_pairings": 87,
  "active_carpool_groups": 34,
  "rentals_this_month": 156,
  "revenue_this_month_cents": 124800,
  "open_reports": 3,
  "avg_compatibility_score": 74.2
}
```

---

## Route Summary

| Domain | Count | Notes |
|--------|-------|-------|
| Auth | 5 | OAuth via Didax school SSO |
| Users | 3 | Profile management |
| Vehicles | 4 | License plate registration |
| Schedules | 3 | Didax sync + manual override |
| Tandem | 6 | Matching algorithm + pairing lifecycle |
| Carpool | 8 | Matching + group management + live status |
| Parking Spots | 4 | Spot data + map rendering |
| Rentals | 11 | Full marketplace lifecycle |
| Payments | 6 | Stripe Connect integration |
| Messaging | 4 | Emote-based chat + REST endpoints |
| Notifications | 4 | Push + in-app |
| Reports | 3 | Dispute filing with photos |
| Admin | 11 | Moderation + analytics |
| **Total** | **72** | |

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "error_code",
  "message": "Human-readable description of what went wrong.",
  "details": {}          // optional, field-level validation errors etc.
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `bad_request` | Missing or invalid request parameters |
| 401 | `unauthorized` | Missing or invalid auth token |
| 403 | `forbidden` | User does not have permission |
| 404 | `not_found` | Resource does not exist |
| 409 | `conflict` | Action conflicts with current state (e.g., already matched) |
| 422 | `validation_error` | Request body fails validation |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Unexpected server error |
| 502 | `upstream_error` | External service (Didax, Stripe) unavailable |
