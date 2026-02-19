# iTandem Backend - Firebase Functions API

## Overview

iTandem is a Harvard-Westlake parking management and carpool matching platform. This backend provides a RESTful API built with Firebase Functions, Express.js, and integrates with Canvas LMS for schedule-based matching algorithms.

## Architecture

### Technology Stack

- **Firebase Functions**: Serverless backend hosting
- **Express.js**: REST API framework
- **Firebase Authentication**: User authentication and authorization
- **Firestore**: NoSQL database for storing users, parking spots, tandems, carpools, and rentals
- **Canvas LMS API**: Integration for fetching student schedules and course data
- **Node.js 22**: Runtime environment
- **Firebase Functions v2**: Second-generation Cloud Functions

### Key Features

1. **Authentication System**
   - Email/password signup and login via Firebase Auth
   - API key generation for mobile app access
   - Dual authentication: Firebase ID tokens or API keys
   - **Separate Admin Authentication** for admin panel access

2. **Admin Panel** (NEW)
   - Professional web-based administrative interface at `/admin.html`
   - Comprehensive user management (search, edit, ban/unban, delete)
   - Parking spot management (create, edit, delete)
   - Tandem/carpool monitoring and management
   - Rental transaction tracking
   - Reports & disputes handling
   - System control (freeze/unfreeze app for maintenance)
   - Real-time analytics dashboard
   - Role-based access control (SUPER_ADMIN, OPERATIONS_ADMIN, CONTENT_ADMIN)

3. **Canvas LMS Integration**
   - Store user Canvas access tokens securely
   - Fetch comprehensive user data (courses, schedule, assignments, enrollments)
   - Extract schedule information for tandem/carpool compatibility matching
   - Automatic data refresh capability

4. **User Management**
   - Profile CRUD operations
   - Permission-based access control
   - Admin and student user types
   - Account status management (active, suspended, banned)

5. **Health Monitoring**
   - Platform health checks
   - Database connectivity verification
   - Platform statistics and metrics

## Project Structure

```
iTandem/
├── functions/                      # Firebase Functions
│   ├── index.js                   # Main entry point, Express app setup
│   ├── package.json               # Node.js dependencies
│   ├── .env.example               # Environment variables template
│   ├── middleware/
│   │   └── auth.js                # Authentication middleware
│   ├── routes/
│   │   ├── auth.js                # Authentication routes
│   │   ├── users.js               # User management routes
│   │   ├── canvas.js              # Canvas API integration routes
│   │   └── health.js              # Health check routes
│   └── services/
│       └── canvasService.js       # Canvas API service
├── src/
│   ├── models/
│   │   └── User.js                # User model with Canvas fields
│   └── enums/
│       ├── UserType.js            # User type enum (STUDENT, ADMIN)
│       └── Permission.js          # Permission enum
├── public/                         # Test web interface
│   ├── index.html                 # Dashboard UI
│   ├── app.js                     # Frontend JavaScript
│   ├── admin.html                 # Admin panel UI (NEW)
│   └── admin-panel.js             # Admin panel JavaScript (NEW)
├── firebase.json                   # Firebase configuration
├── .firebaserc                     # Firebase project config
├── firestore.rules                 # Firestore security rules
└── firestore.indexes.json          # Firestore index definitions
```

## Database Schema

### Collections

#### `users`
Stores user account information and Canvas integration data.

```javascript
{
  userID: string,              // Firebase Auth UID
  name: string,
  email: string,
  licensePlate: string?,
  phoneNumber: string?,
  userType: string,            // STUDENT, ADMIN, etc.
  permissions: array,
  apiKey: string?,             // Mobile app API key
  canvasAccessToken: string?,  // Canvas API token (encrypted in production)
  canvasDataLinked: boolean,
  canvasUserId: string?,
  canvasUserName: string?,
  canvasEmail: string?,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `canvasData`
Stores cached Canvas LMS data for each user.

```javascript
{
  userId: string,
  profile: object,             // Canvas user profile
  courses: array,              // User's courses
  calendar: array,             // Calendar events
  assignments: array,          // Upcoming assignments
  enrollments: array,          // Course enrollments
  scheduleInfo: object,        // Extracted schedule for matching
  lastUpdated: string,
  tokenLastVerified: timestamp
}
```

#### `apiKeys`
Stores API keys for mobile app authentication.

```javascript
{
  userId: string,
  key: string,                 // The actual API key (hashed in production)
  name: string,
  active: boolean,
  createdAt: timestamp,
  expiresAt: timestamp?,
  lastUsedAt: timestamp?,
  revokedAt: timestamp?
}
```

#### `parkingSpots`
Parking spot inventory and ownership.

```javascript
{
  spotId: string,
  lotName: string,             // Taper, Coldwater, Hacienda, St Michael, Hamilton
  spotNumber: string,
  ownerId: string,             // User ID of spot owner
  available: boolean,
  distance: number,            // Distance metric for pricing
  createdAt: timestamp
}
```

#### `tandemPairings`
Tandem parking partnerships.

```javascript
{
  userIds: array,              // Array of 2 user IDs
  spotId: string,
  status: string,              // active, inactive
  compatibilityScore: number,  // Calculated from schedules
  createdAt: timestamp
}
```

#### `carpools`
Carpool groups.

```javascript
{
  memberIds: array,            // Array of user IDs
  driverUserId: string,
  schedule: object,
  location: object,
  createdAt: timestamp
}
```

#### `rentals`
Parking spot rental transactions.

```javascript
{
  renterId: string,
  ownerId: string,
  spotId: string,
  rentalDate: timestamp,
  amount: number,
  status: string,              // confirmed, cancelled, completed
  createdAt: timestamp
}
```

## API Endpoints

### Base URL
- Development: `http://localhost:5001/itandem-firebase/us-central1/api`
- Production: `https://your-project.web.app/api`

### Authentication Endpoints

#### POST `/auth/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "password123",
  "name": "John Doe",
  "phoneNumber": "555-1234",
  "licensePlate": "ABC123",
  "userType": "STUDENT"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "userId": "firebase_uid",
  "customToken": "firebase_custom_token",
  "user": { ... }
}
```

#### POST `/auth/login`
Verify user credentials (used for custom login flows).

**Request Body:**
```json
{
  "email": "student@example.com"
}
```

#### POST `/auth/canvas-token`
Link Canvas LMS account and fetch user data.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "canvasAccessToken": "your_canvas_api_token"
}
```

**Response:**
```json
{
  "message": "Canvas access token stored successfully",
  "canvasProfile": {
    "id": 12345,
    "name": "John Doe",
    "email": "student@example.com",
    "avatarUrl": "..."
  },
  "dataFetched": {
    "coursesCount": 6,
    "upcomingEventsCount": 15,
    "assignmentsCount": 8
  }
}
```

#### GET `/auth/canvas-token`
Check if user has linked Canvas account.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

#### POST `/auth/generate-api-key`
Generate API key for mobile app access.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
```

**Request Body:**
```json
{
  "name": "Mobile App Key",
  "expiresInDays": 365
}
```

**Response:**
```json
{
  "message": "API key generated successfully",
  "apiKey": "64_character_hex_string",
  "apiKeyId": "firestore_doc_id",
  "expiresAt": "2025-02-10T00:00:00Z",
  "warning": "Store this API key securely. It will not be shown again."
}
```

#### GET `/auth/api-keys`
List all API keys for authenticated user.

#### DELETE `/auth/api-keys/:keyId`
Revoke an API key.

### User Endpoints

#### GET `/users/me`
Get current user's profile.

**Headers:**
```
Authorization: Bearer <firebase_id_token>
OR
x-api-key: <your_api_key>
```

#### PUT `/users/me`
Update current user's profile.

**Request Body:**
```json
{
  "name": "New Name",
  "phoneNumber": "555-5678",
  "licensePlate": "XYZ789"
}
```

#### GET `/users/:userId`
Get another user's public profile.

#### GET `/users`
List all users (admin only).

#### DELETE `/users/:userId`
Delete user account (admin or self).

### Canvas Integration Endpoints

#### GET `/canvas/profile`
Get user's Canvas profile.

#### GET `/canvas/courses`
Get user's Canvas courses.

#### GET `/canvas/schedule`
Get user's Canvas schedule/calendar.

**Query Parameters:**
- `startDate`: ISO date string (default: today)
- `endDate`: ISO date string (default: 30 days from now)

#### GET `/canvas/assignments`
Get user's upcoming Canvas assignments.

#### GET `/canvas/data`
Get cached comprehensive Canvas data.

#### POST `/canvas/refresh`
Refresh Canvas data from API.

#### GET `/canvas/schedule-info`
Get extracted schedule information for matching algorithms.

### Health Monitoring Endpoints

#### GET `/health`
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-10T...",
  "uptime": 12345,
  "service": "iTandem API",
  "version": "1.0.0"
}
```

#### GET `/health/detailed`
Detailed health check including database and external services.

#### GET `/health/stats`
Get platform statistics.

**Response:**
```json
{
  "platform": {
    "totalUsers": 150,
    "usersWithCanvas": 120,
    "canvasLinkageRate": "80.0%"
  },
  "parking": {
    "totalSpots": 200,
    "totalRentals": 45
  },
  "social": {
    "activeTandems": 60,
    "activeCarpools": 15
  }
}
```

#### GET `/health/database`
Check database collections and document counts.

## Security

### Firestore Security Rules

The `firestore.rules` file implements row-level security:

- **Users**: Can read/write own data; admins can read/write all
- **Canvas Data**: Only owner or admin can access
- **Parking Spots**: All authenticated users can read; only owner/admin can modify
- **Tandems/Carpools**: Only members or admins can access
- **Rentals**: Only renter, owner, or admin can access
- **API Keys**: Only owner or admin can access

### Authentication Methods

1. **Firebase ID Tokens**: For web applications
   - Include in header: `Authorization: Bearer <token>`
   - Tokens expire after 1 hour
   - Automatically refreshed by Firebase SDK

2. **API Keys**: For mobile applications
   - Include in header: `x-api-key: <your_key>`
   - Keys are long-lived (configurable expiration)
   - Can be revoked at any time

### Best Practices

- **Never commit `.env` files** - Use `.env.example` as template
- **Never commit service account keys** - Store securely and add to `.gitignore`
- **Rotate API keys regularly** - Especially for production environments
- **Use HTTPS only** - API enforces HTTPS in production
- **Encrypt Canvas tokens** - In production, encrypt tokens at rest
- **Rate limiting** - Implement for production (not included in MVP)

## Setup Instructions

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Firestore, Functions, Auth, and Hosting enabled

### Initial Setup

1. **Clone the repository**
   ```powershell
   git clone <repository_url>
   cd iTandem
   ```

2. **Login to Firebase**
   ```powershell
   firebase login
   ```

3. **Initialize Firebase (if not done)**
   ```powershell
   firebase init
   ```
   Select: Functions, Firestore, Hosting, Authentication

4. **Install dependencies**
   ```powershell
   cd functions
   npm install
   ```

5. **Configure environment variables**
   ```powershell
   cp .env.example .env
   ```
   Edit `.env` and add your Canvas API key and other secrets.

6. **Update Firebase config in test interface**
   Edit `public/app.js` and replace the Firebase config with your project's config from Firebase Console.

### Canvas API Token

To get your Canvas API token:

1. Log into Canvas LMS
2. Go to Account → Settings
3. Scroll to "Approved Integrations"
4. Click "+ New Access Token"
5. Enter purpose: "iTandem Integration"
6. Generate token and copy it
7. Store it securely - **never commit it to git**

Your token: `349~EGanBHzF6tRenP96FVaAFYDGkExutYnzfhYmrhBBDKuZ4XXyF3XRywf73YBmGaaU`

### Local Development

1. **Start the Firebase emulator**
   ```powershell
   firebase emulators:start
   ```
   This starts local emulators for Functions, Firestore, and Auth.

2. **Access the test dashboard**
   Open http://localhost:5000 in your browser

3. **Test the API**
   - Create a test account
   - Link Canvas account
   - Generate API key
   - View Canvas data
   - Check platform health

### Deployment

1. **Deploy Firestore rules and indexes**
   ```powershell
   firebase deploy --only firestore
   ```

2. **Deploy functions**
   ```powershell
   firebase deploy --only functions
   ```

3. **Deploy hosting (test interface)**
   ```powershell
   firebase deploy --only hosting
   ```

4. **Deploy everything**
   ```powershell
   firebase deploy
   ```

## Canvas LMS API Integration

### Supported Canvas Endpoints

The `CanvasService` class integrates with:

- `/users/self/profile` - User profile
- `/courses` - User's courses
- `/calendar_events` - Schedule/calendar
- `/users/self/upcoming_events` - Upcoming assignments
- `/users/self/enrollments` - Course enrollments

### Schedule Extraction

The system extracts schedule information for compatibility matching:

- Regular class schedule (by day of week)
- Upcoming events and commitments
- Course information
- Extracurricular activities

This data powers the tandem and carpool matching algorithms.

### Canvas API Documentation

Full Canvas LMS API documentation: https://developerdocs.instructure.com/services/canvas

## Testing

### Manual Testing with Test Interface

1. Open the test dashboard (localhost:5000 or deployed URL)
2. Create a test account
3. Test Canvas integration with your Canvas token
4. Generate an API key
5. Use the API key to test mobile app endpoints

### Testing with Postman/cURL

**Example: Create account**
```bash
curl -X POST http://localhost:5001/itandem-firebase/us-central1/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "userType": "STUDENT"
  }'
```

**Example: Get user profile with API key**
```bash
curl http://localhost:5001/itandem-firebase/us-central1/api/users/me \
  -H "x-api-key: your_api_key_here"
```

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure `cors({ origin: true })` is enabled in Express app
2. **Authentication fails**: Check that Firebase ID token is valid and not expired
3. **Canvas API errors**: Verify Canvas access token is valid
4. **Firestore permission denied**: Review `firestore.rules` for proper permissions
5. **Functions timeout**: Increase timeout in `firebase.json` if needed

### Logs

View Firebase Function logs:
```powershell
firebase functions:log
```

View real-time logs during development:
```powershell
firebase emulators:start --inspect-functions
```

## Future Enhancements

### Planned Features

1. **DIDAX School SSO Integration** - Replace email/password with school single sign-on
2. **Tandem Compatibility Algorithm** - Implement schedule-based matching
3. **Carpool Matching Algorithm** - Location and schedule-based matching
4. **Stripe Payment Integration** - For parking spot rentals and fines
5. **Real-time Chat** - For tandem/carpool communication
6. **Push Notifications** - For mobile app alerts
7. **Blockchain Integration** - For spot ownership verification (as specified in MVP)
8. **Photo Verification** - Web3 photos for rental disputes
9. **License Plate Recognition** - Automatic spot monitoring
10. **Admin Dashboard** - Advanced management interface

### Security Enhancements for Production

- Encrypt Canvas tokens at rest
- Implement rate limiting
- Add request validation middleware
- Enable Cloud Armor for DDoS protection
- Add audit logging for all operations
- Implement IP whitelisting for admin endpoints

## Contributing

When making changes:

1. Read this README to understand the system
2. Follow existing code patterns and style
3. Update documentation for new features
4. Test thoroughly before committing
5. Make git commits as you complete features
6. Never commit sensitive data (keys, tokens, `.env` files)

## License

Proprietary - Harvard-Westlake School iTandem Project

## Contact

For questions or issues, contact the iTandem development team.

---

**Last Updated**: February 10, 2026
**Version**: 1.0.0
