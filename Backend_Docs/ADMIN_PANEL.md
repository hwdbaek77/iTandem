# iTandem Admin Panel Documentation

## Overview

The iTandem Admin Panel is a comprehensive web-based administrative interface for managing the entire iTandem application. It provides administrators with complete control over users, parking spots, tandems, carpools, rentals, reports, and system settings.

## Access

**URL:** https://itandem-api.web.app/admin.html

**Authentication:** 
- Separate authentication system from the main app
- Uses Firebase Authentication + custom admin verification
- Only users in the `admins` Firestore collection can access the panel

## Features

### 1. Dashboard
- **Analytics Overview:** Real-time statistics on users, tandems, rentals, and reports
- **Recent Activity:** Quick view of important metrics
- **System Status:** Current app health and availability status

### 2. User Management
- **Search & Filter:** Find users by name, email, or other criteria
- **View All Users:** Paginated list of all app users
- **Edit User:** Modify any user property including:
  - Name, email, phone number
  - License plate
  - User type (SOPHOMORE, JUNIOR, SENIOR)
  - Account status (active, suspended, banned)
- **Ban/Unban Users:**
  - Temporary bans (specify duration in days)
  - Permanent bans
  - Custom ban reason
- **Delete Users:** Remove user accounts entirely

### 3. Parking Spot Management
- **View All Spots:** Grid view of all parking spots
- **Create New Spot:** Add parking spots to the system
- **Edit Spot:** Modify spot details (lot, number, type, distance)
- **Delete Spot:** Remove parking spots
- **Monitor Availability:** Real-time spot occupancy status

### 4. Tandem Management
- **View Tandems:** List all tandem pairings
- **Monitor Activity:** Track active vs. inactive tandems
- **Compatibility Analysis:** View matching scores
- **Intervention:** Manually adjust or dissolve tandems if needed

### 5. Carpool Management
- **View Carpools:** List all carpool groups
- **Group Details:** Members, schedules, routes
- **Status Monitoring:** Track active carpools
- **Moderation:** Manage disputes or issues

### 6. Rental Management
- **Transaction History:** Complete rental log
- **Status Tracking:** Active, completed, disputed rentals
- **Payment Verification:** Monitor transaction amounts
- **Dispute Resolution:** Handle rental-related issues

### 7. Reports & Disputes
- **View Reports:** All user-submitted reports
- **Priority Queue:** Pending reports requiring action
- **Investigation:** Access full report details
- **Resolution:** Mark reports as resolved with notes

### 8. System Control
- **App Status:** Monitor overall system health
- **Freeze App:** Temporarily disable user access
  - Display custom maintenance message
  - Prevents all non-admin access
  - Use for emergency maintenance or critical issues
- **Unfreeze App:** Restore normal operation
- **System Information:** Technical details (API version, database, etc.)

## Technical Architecture

### Frontend
- **HTML5** with semantic structure
- **Tailwind CSS** for responsive, professional styling
- **Vanilla JavaScript** for lightweight, fast interactions
- **Firebase SDK** for authentication integration

### Backend Integration
- **API Endpoint:** `/apiv2/admin-panel/*`
- **Separate Auth:** `/apiv2/admin-auth/*`
- **Authentication:** Bearer token (Firebase ID token)
- **Authorization:** `requireAdmin` middleware on all routes

### API Routes

#### Authentication
```
POST /admin-auth/login       - Admin login instructions
POST /admin-auth/verify      - Verify admin status
GET  /admin-auth/session     - Get admin session data
```

#### User Management
```
GET    /admin-panel/users                - List users (with pagination & search)
GET    /admin-panel/users/:userId        - Get user details
PUT    /admin-panel/users/:userId        - Update user
POST   /admin-panel/users/:userId/ban    - Ban user
POST   /admin-panel/users/:userId/unban  - Unban user
DELETE /admin-panel/users/:userId        - Delete user
```

#### Spot Management
```
GET    /admin-panel/spots         - List all spots
POST   /admin-panel/spots         - Create new spot
PUT    /admin-panel/spots/:spotId - Update spot
DELETE /admin-panel/spots/:spotId - Delete spot
```

#### System Control
```
GET  /admin-panel/system/status    - Get app status
POST /admin-panel/system/freeze    - Freeze app
POST /admin-panel/system/unfreeze  - Unfreeze app
```

#### Analytics
```
GET /admin-panel/analytics/overview - Get system analytics
```

## Admin Roles

The system supports three admin roles with different permissions:

1. **SUPER_ADMIN**
   - Full system access
   - Can create/delete other admins
   - Can freeze/unfreeze app
   - Can delete users and data

2. **OPERATIONS_ADMIN**
   - User management (view, edit, ban/unban)
   - Spot management
   - Reports & disputes
   - Cannot delete admins or freeze app

3. **CONTENT_ADMIN**
   - View-only access to most features
   - Can update spot information
   - Can view reports but not resolve them
   - Cannot ban users or manage admins

## Security Features

1. **Separate Authentication:** Admin panel uses different auth flow than main app
2. **Token-Based Auth:** All API calls require valid Firebase ID token
3. **Role Verification:** Backend verifies admin status and role on every request
4. **Audit Logging:** All admin actions are logged with timestamp and admin ID
5. **Session Management:** Automatic logout on token expiration

## Usage Workflow

### First-Time Setup

1. **Create First Admin:**
   ```
   POST /setup/bootstrap-admin
   {
     "email": "admin@example.com",
     "name": "Admin Name",
     "role": "SUPER_ADMIN"
   }
   ```

2. **Set Firebase Password:**
   - Go to Firebase Console → Authentication
   - Find the admin user
   - Set password manually

3. **Login to Admin Panel:**
   - Navigate to https://itandem-api.web.app/admin.html
   - Enter admin credentials
   - System verifies admin status and redirects to dashboard

### Daily Operations

#### Managing Users
1. Go to **Users** tab
2. Use search to find specific user or view all
3. Click **Edit** to modify user details
4. Click **Ban** to suspend user (specify reason and duration)
5. Click **Unban** to restore access

#### Managing Spots
1. Go to **Parking Spots** tab
2. View all spots in grid layout
3. Click **Add New Spot** to create
4. Click **Edit** on any spot to modify
5. Click **Delete** to remove spot

#### Freezing App (Emergency Maintenance)
1. Go to **System Control** tab
2. Click **Freeze App**
3. Enter maintenance message for users
4. Confirm action
5. All non-admin users will see maintenance screen

#### Unfreezing App
1. Go to **System Control** tab
2. Click **Unfreeze App**
3. Confirm action
4. Normal service restored immediately

## Troubleshooting

### Cannot Login
- **Check email is in `admins` collection** in Firestore
- **Verify password** in Firebase Console → Authentication
- **Check `active: true`** in admin document
- **Verify role** is SUPER_ADMIN, OPERATIONS_ADMIN, or CONTENT_ADMIN

### API Errors (401 Unauthorized)
- Token may be expired - logout and login again
- Admin document may be missing or inactive
- Check browser console for detailed error messages

### Actions Not Working
- **Verify your role permissions** - some actions require SUPER_ADMIN
- **Check network tab** for API response errors
- **Ensure backend is deployed** - test API directly

### UI Not Loading Data
- **Open browser console** to check for JavaScript errors
- **Verify API_BASE_URL** is correct in admin-panel.js
- **Test API endpoints** directly using curl/Postman

## Best Practices

1. **Use Temporary Bans First:** Before permanent bans, try temporary suspension
2. **Document Ban Reasons:** Always provide clear reason for user bans
3. **Test Before Freezing:** Only freeze app in true emergencies
4. **Monitor Dashboard:** Check analytics daily for unusual activity
5. **Regular Backups:** Export Firestore data regularly
6. **Audit Logs:** Review admin action logs periodically
7. **Multi-Admin:** Always have at least 2 SUPER_ADMIN accounts

## Future Enhancements

The following features are planned for future releases:

- **Advanced Analytics:** Charts, graphs, trend analysis
- **Bulk Operations:** Ban/edit multiple users at once
- **Email Notifications:** Automatic emails for bans, reports
- **Export Data:** CSV/JSON export for users, spots, rentals
- **Activity Logs:** Detailed admin action history
- **Custom Reports:** Generate custom analytics reports
- **Mobile Support:** Responsive design improvements for tablets/phones

## Support

For issues or questions about the admin panel:
- Check this documentation first
- Review API_ROUTES.md for endpoint details
- Check Firebase Console logs for backend errors
- Contact system administrator

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-10  
**Deployed:** https://itandem-api.web.app/admin.html
