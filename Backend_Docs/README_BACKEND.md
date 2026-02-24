# iTandem Backend - Firebase Functions API

## Overview

iTandem is a Harvard-Westlake parking management, tandem matching, and carpool platform. The backend provides a RESTful API built with Firebase Functions v2, Express.js, and integrates with Canvas LMS and a custom schedule-based compatibility algorithm.

## Architecture

### Technology Stack

- **Firebase Functions v2**: Serverless backend (Node.js 22)
- **Express.js**: REST API framework
- **Firebase Authentication**: User auth with email/password + API keys
- **Firestore**: NoSQL database (standard `(default)` database)
- **Firebase Storage**: PDF schedule file storage
- **Firebase Hosting**: Admin panel + API test dashboard
- **Firebase App Hosting**: Next.js SSR web app deployment
- **Canvas LMS API**: Student schedule and course data integration
- **Scheduling System**: PDF-based HW bell schedule parsing + compatibility algorithm

### Key Features

1. **Authentication System**
   - Email/password signup and login via Firebase Auth
   - API key generation for mobile app access
   - Dual auth: Firebase ID tokens or API keys
   - Separate admin authentication for admin panel

2. **Admin Panel** (`/admin.html`)
   - User management (search, edit, ban/unban, delete)
   - Parking spot management (CRUD)
   - System control (freeze/unfreeze app)
   - Analytics dashboard
   - Role-based access (SUPER_ADMIN, OPERATIONS_ADMIN, CONTENT_ADMIN)

3. **Schedule System** (NEW)
   - PDF schedule upload and automatic parsing
   - HW 6-day rotating bell schedule mapping
   - Tandem compatibility scoring (0-100) across 5 weighted factors
   - Ranked partner matching across all users
   - Firebase Storage for PDF persistence

4. **Parking & Rentals** (NEW)
   - Public spot browsing by lot
   - Spot detail views with availability
   - Rental creation with atomic spot reservation
   - Rental cancellation with spot release

5. **Canvas LMS Integration**
   - Canvas access token storage
   - Course, schedule, enrollment, and assignment data fetching
   - Data caching in Firestore

6. **Health Monitoring**
   - Platform health checks
   - Database connectivity verification
   - Platform statistics

## Project Structure

```
iTandem/
├── functions/                          # Firebase Functions backend
│   ├── index.js                       # Express app + route registration
│   ├── package.json                   # Dependencies (Node.js 22)
│   ├── middleware/
│   │   └── auth.js                    # Auth middleware (Firebase token, API key, admin check)
│   ├── routes/
│   │   ├── auth.js                    # User auth (signup, login, canvas-token, api-keys)
│   │   ├── users.js                   # User CRUD
│   │   ├── canvas.js                  # Canvas LMS integration
│   │   ├── health.js                  # Health checks
│   │   ├── admin-auth.js              # Admin authentication
│   │   ├── admin-panel.js             # Admin operations
│   │   ├── schedules.js               # Schedule upload, parsing, matching (NEW)
│   │   ├── spots.js                   # Public parking spot browsing (NEW)
│   │   └── rentals.js                 # Rental creation and management (NEW)
│   └── services/
│       ├── canvasService.js           # Canvas API client
│       └── scheduling/                # Schedule system (NEW)
│           ├── index.js               # Barrel export
│           ├── bellSchedule.js        # HW 6-day bell schedule config
│           ├── scheduleBuilder.js     # Per-day campus presence builder
│           ├── compatibilityAlgorithm.js  # 5-factor compatibility scorer
│           └── pdfParser.js           # PDF-to-structured-data parser (buffer-based)
├── web/                                # Next.js web app (NEW)
│   ├── app/                           # App Router pages
│   │   ├── layout.js                  # Root layout with AuthProvider
│   │   ├── page.js                    # Home dashboard (real API data)
│   │   ├── login/page.js             # Firebase Auth login/signup
│   │   ├── parking/                   # Parking lot/spot browsing + rental
│   │   ├── profile/page.js           # Profile editor + schedule upload
│   │   ├── carpool/page.js           # Tandem matching display
│   │   └── chat/page.js              # Chat stub
│   ├── components/                    # Shared UI components
│   │   ├── AppShell.js               # Main layout shell with AuthGuard
│   │   ├── AuthGuard.js              # Redirects unauthenticated users
│   │   ├── Providers.js              # Client-side context providers
│   │   ├── Header.js                 # App header with user initial
│   │   ├── BottomNav.js              # Bottom navigation
│   │   ├── StatusCard.js             # Dashboard status cards
│   │   └── SpotCard.js               # Parking spot card
│   ├── context/
│   │   └── AuthContext.js             # Firebase Auth state management
│   └── lib/
│       ├── firebase.js                # Firebase client SDK init
│       └── api.js                     # Centralized API client with auth tokens
├── public/                             # Firebase Hosting (admin panel + test UI)
│   ├── index.html                     # Landing page
│   ├── admin.html                     # Admin panel UI
│   ├── admin-panel.js                 # Admin panel logic
│   ├── test.html                      # API test dashboard
│   ├── app.js                         # Test dashboard logic
│   ├── firebase-config.js             # Firebase config (GITIGNORED)
│   └── firebase-config.example.js     # Config template (committed)
├── scheduling system/                  # Standalone scheduling module (reference)
├── firebase.json                       # Firebase project config
├── firestore.rules                     # Firestore security rules
├── storage.rules                       # Storage security rules (NEW)
├── apphosting.yaml                     # Firebase App Hosting config (NEW)
└── Backend_Docs/                       # Documentation
```

## API Endpoints

### Base URL
- Production: `https://us-central1-itandem-api.cloudfunctions.net/apiv2`

### Authentication (`/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | None | Create user account |
| POST | `/auth/login` | None | Verify credentials |
| POST | `/auth/canvas-token` | Bearer | Link Canvas LMS account |
| GET | `/auth/canvas-token` | Bearer | Check Canvas link status |
| POST | `/auth/generate-api-key` | Bearer | Generate mobile API key |
| GET | `/auth/api-keys` | Bearer | List user's API keys |
| DELETE | `/auth/api-keys/:keyId` | Bearer | Revoke an API key |

### Users (`/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Bearer/API | Get current user profile |
| PUT | `/users/me` | Bearer/API | Update current user |
| GET | `/users/:userId` | Bearer/API | Get another user's profile |
| GET | `/users` | Admin | List all users |
| DELETE | `/users/:userId` | Admin | Delete user account |

### Schedules (`/schedules`) - NEW
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/schedules/upload` | Bearer | Upload & parse schedule PDF |
| GET | `/schedules/me` | Bearer | Get my parsed schedule |
| GET | `/schedules/:userId` | Admin | Get user's schedule |
| POST | `/schedules/compare/:userId` | Bearer | Compare with another user |
| GET | `/schedules/matches/ranked` | Bearer | Get ranked partner matches |

### Spots (`/spots`) - NEW
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/spots` | Bearer | List spots (filterable) |
| GET | `/spots/lots` | Bearer | Get lot summary with counts |
| GET | `/spots/lot/:lotName` | Bearer | Get spots for a lot |
| GET | `/spots/:spotId` | Bearer | Get spot details |

### Rentals (`/rentals`) - NEW
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rentals` | Bearer | Create rental reservation |
| GET | `/rentals/me` | Bearer | Get my rentals |
| GET | `/rentals/:rentalId` | Bearer | Get rental details |
| PUT | `/rentals/:rentalId/cancel` | Bearer | Cancel a rental |

### Canvas (`/canvas`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/canvas/profile` | Bearer | Canvas profile |
| GET | `/canvas/courses` | Bearer | Canvas courses |
| GET | `/canvas/schedule` | Bearer | Canvas schedule |
| GET | `/canvas/assignments` | Bearer | Canvas assignments |
| GET | `/canvas/data` | Bearer | All cached Canvas data |
| POST | `/canvas/refresh` | Bearer | Refresh Canvas data |

### Health (`/health`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Basic health check |
| GET | `/health/detailed` | None | Detailed health check |
| GET | `/health/stats` | None | Platform statistics |

### Admin (`/admin-auth`, `/admin-panel`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin-auth/login` | None | Admin login |
| POST | `/admin-auth/verify` | Bearer | Verify admin session |
| GET | `/admin-panel/users` | Admin | List/search users |
| PUT | `/admin-panel/users/:id` | Admin | Update user |
| POST | `/admin-panel/users/:id/ban` | Admin | Ban user |
| POST | `/admin-panel/users/:id/unban` | Admin | Unban user |
| GET | `/admin-panel/system/status` | Admin | App system status |
| POST | `/admin-panel/system/freeze` | Admin | Freeze app |
| POST | `/admin-panel/system/unfreeze` | Admin | Unfreeze app |
| GET | `/admin-panel/analytics/overview` | Admin | Analytics dashboard |

## Database Schema

### Firestore Collections

#### `users/{userId}`
```javascript
{
  name: string,
  email: string,
  userType: "SOPHOMORE" | "JUNIOR" | "SENIOR",
  phone: string?,
  licensePlate: string?,
  canvasAccessToken: string?,
  canvasDataLinked: boolean,
  status: "active" | "suspended" | "banned",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `schedules/{userId}` (NEW)
```javascript
{
  userId: string,
  name: string,              // from PDF header
  grade: number,             // 10, 11, or 12
  courses: [...],            // parsed academic courses with block patterns
  coCurriculars: [...],      // co-curricular activities
  directedStudies: [...],
  seminars: [...],
  builtSchedule: {           // per-day campus presence map
    name, grade, days: { 1..6: { arrival, departure, slots, ... } }
  },
  pdfStoragePath: string,    // Firebase Storage path
  uploadedAt: timestamp,
  parsedAt: timestamp
}
```

#### `parkingSpots/{spotId}`
```javascript
{
  lot: string,               // Taper, Coldwater, Hacienda, St Michael, Hamilton
  number: string,
  type: string?,
  distanceMiles: number?,
  isAvailable: boolean,
  ownerId: string?,
  currentRenterId: string?,
  createdAt: timestamp
}
```

#### `rentals/{rentalId}` (NEW)
```javascript
{
  renterId: string,
  spotId: string,
  ownerId: string?,
  lot: string,
  spotNumber: string,
  type: string,
  status: "active" | "cancelled" | "completed",
  startDate: timestamp,
  endDate: timestamp?,
  createdAt: timestamp
}
```

#### `admins/{userId}`
```javascript
{
  email: string,
  role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "CONTENT_ADMIN",
  active: boolean,
  createdAt: timestamp
}
```

#### `canvasData/{userId}`, `apiKeys/{keyId}`, `tandemPairings/{id}`, `carpools/{id}`
See previous documentation for schemas.

## Scheduling System

### How It Works

1. **Upload**: Student uploads their HW schedule PDF via `POST /schedules/upload`
2. **Parse**: `pdfParser.js` extracts student name, grade, and course table with block patterns
3. **Build**: `scheduleBuilder.js` maps courses onto the 6-day bell schedule, computing arrival/departure times and free periods per day
4. **Store**: Parsed data + built schedule saved to Firestore; PDF saved to Firebase Storage
5. **Match**: `compatibilityAlgorithm.js` computes a 0-100 score between any two students

### Compatibility Scoring (5 factors)

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Schedule Overlap | 35% | Minutes both have class at the same time (less = better) |
| Arrival/Departure | 25% | Gap between one leaving and other arriving (more = better) |
| Lunch Schedule | 15% | Whether lunch times conflict for spot usage |
| Extracurriculars | 15% | Difference in departure times (more separation = better) |
| Grade Level | 10% | Valid pairs: 12+12, 11+11, 11+10, 10+10 |

### PDF Format Expected

Harvard-Westlake student schedule PDFs with:
- Header containing student ID, date, grade, and name
- Course table with columns: Course Code, Title, Room, Schedule Pattern, Teacher
- Schedule patterns like `x.6.x.6.x.6` (6 values for 6 rotation days)

## Security

### API Key Config
- Firebase client config is stored in `public/firebase-config.js` (gitignored)
- Copy `public/firebase-config.example.js` and fill in real values
- For the Next.js app, config is in `web/.env.local` (gitignored)

### Firestore Rules
- Users: read/write own data; admins can access all
- Schedules: read/write own data; admins can access all
- Parking Spots: all authenticated can read; owner/admin can modify
- Rentals: renter, owner, or admin can access

### Storage Rules
- Schedule PDFs: only owning user can read/write (max 10MB, PDF only)
- Authenticated users can read any schedule PDF

## Setup Instructions

### Prerequisites
- Node.js 22+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Auth, Firestore, Functions, Hosting, and Storage enabled

### Quick Start

```powershell
# 1. Install backend dependencies
cd functions
npm install

# 2. Install web app dependencies
cd ../web
npm install

# 3. Set up Firebase config for hosting
cp public/firebase-config.example.js public/firebase-config.js
# Edit firebase-config.js with your real API key

# 4. Set up web app env
cp web/.env.example web/.env.local
# Edit .env.local with your real values

# 5. Deploy everything
firebase deploy --only "functions,hosting,firestore:rules,storage"

# 6. Set up Firebase App Hosting for the Next.js app
firebase init apphosting
```

### Deployment Commands

```powershell
firebase deploy --only functions          # Backend API
firebase deploy --only hosting            # Admin panel + test UI
firebase deploy --only "firestore:rules"  # Firestore security rules
firebase deploy --only storage            # Storage security rules
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Ensure `cors({ origin: true })` in Express app |
| Auth fails | Check Firebase ID token validity and expiration |
| Canvas API errors | Verify Canvas access token |
| Firestore permission denied | Review `firestore.rules` |
| Schedule parse fails | Ensure PDF matches expected HW format |
| Storage upload fails | Enable Storage in Firebase Console first |
| 401 on API calls | Include `Authorization: Bearer <token>` header |

### Logs

```powershell
firebase functions:log              # View function logs
firebase emulators:start            # Local development
```

---

**Last Updated**: February 24, 2026
**Version**: 2.0.0
**API Base**: `https://us-central1-itandem-api.cloudfunctions.net/apiv2`
