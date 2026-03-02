# iTandem Deployment Guide

Step-by-step instructions for deploying the iTandem backend (Firebase Functions), admin panel (Firebase Hosting), and web app (Firebase App Hosting).

## Prerequisites

Before you start, make sure you have the following installed and configured:

### 1. Node.js 22+

Download from https://nodejs.org (use the LTS version). Verify with:

```powershell
node --version   # Should output v22.x.x or higher
npm --version    # Should output 10.x.x or higher
```

If you have an older version, uninstall it and install v22. Firebase Functions **require** Node.js 22 — earlier versions will fail to deploy.

### 2. Firebase CLI

Install globally:

```powershell
npm install -g firebase-tools
```

Verify with:

```powershell
firebase --version   # Should output 13.x.x or higher
```

### 3. Firebase Login

Log into the Firebase CLI with the Google account that has access to the `itandem-api` Firebase project:

```powershell
firebase login
```

This opens a browser window. Sign in and grant permissions. Verify access:

```powershell
firebase projects:list
```

You should see `itandem-api` in the list. If not, ask the project owner to add your Google account as an Editor in the Firebase Console under **Project Settings > Users and permissions**.

### 4. Git Clone

Clone the repository and switch to the correct branch:

```powershell
git clone https://github.com/hwdbaek77/iTandem.git
cd iTandem
git checkout MergeUIandAPI
```

## Installation

### Step 1: Install Backend Dependencies

```powershell
cd functions
npm install
```

This installs Express, Firebase Admin SDK, pdf-parse, and all other backend packages. You should see `node_modules/` appear inside the `functions/` directory.

**Common issues:**
- If `npm install` fails with permission errors, try running your terminal as Administrator.
- If you see warnings about deprecated packages, that's normal — they don't prevent deployment.
- If you get `ERESOLVE` errors, try `npm install --legacy-peer-deps`.

### Step 2: Install Web App Dependencies

```powershell
cd ../web
npm install
```

### Step 3: Set Up Firebase Config (for Hosting)

The Firebase client-side API key is not committed to git for security. You need to create it locally:

```powershell
cd ../public
copy firebase-config.example.js firebase-config.js
```

Then open `public/firebase-config.js` and replace the placeholder values with the real Firebase config. Get these values from the Firebase Console under **Project Settings > General > Your apps > Web app**.

The file should look like:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "your-real-api-key",
    authDomain: "itandem-api.firebaseapp.com",
    projectId: "itandem-api",
    storageBucket: "itandem-api.firebasestorage.app",
    messagingSenderId: "954488814160",
    appId: "1:954488814160:web:18f5bf2a958bb7ce0b98c5"
};
```

### Step 4: Set Up Web App Environment

```powershell
cd ../web
copy .env.example .env.local
```

Edit `web/.env.local` with the same Firebase config values. See `web/.env.example` for the format.

## Deployment

### Deploy Everything at Once

From the project root (`iTandem/` directory):

```powershell
cd c:\path\to\iTandem
firebase deploy --only "functions,hosting,firestore:rules,storage"
```

**Important:** The quotes around the target list are required in PowerShell. Without them you'll get a parse error.

This single command deploys:
- **Functions**: The Express API to Cloud Functions v2
- **Hosting**: The admin panel and test dashboard HTML files
- **Firestore rules**: Database security rules
- **Storage rules**: Firebase Storage security rules for PDF uploads

Expected output on success:

```
+  functions[apiv2(us-central1)] Successful update operation.
+  hosting[itandem-api]: release complete
+  firestore: released rules firestore.rules to cloud.firestore
+  storage: released rules storage.rules to firebase.storage
+  Deploy complete!
```

### Deploy Individually

If you only changed one part of the system, you can deploy just that:

```powershell
# Backend API only
firebase deploy --only functions

# Admin panel / test dashboard only
firebase deploy --only hosting

# Firestore security rules only
firebase deploy --only "firestore:rules"

# Storage security rules only
firebase deploy --only storage

# Next.js web app (App Hosting)
firebase deploy --only apphosting
```

## Troubleshooting Deployment Errors

### "Runtime Node.js 18 was decommissioned"

Your `functions/package.json` must specify Node.js 22:

```json
"engines": {
  "node": "22"
}
```

Also make sure your local Node.js version is 22+. Firebase builds functions using the version specified in `package.json`.

### "Cannot find module './routes/something'"

This means `functions/index.js` is trying to `require()` a route file that doesn't exist. Check that all files listed in `functions/index.js` actually exist in `functions/routes/`. The current routes are:

```
functions/routes/auth.js
functions/routes/users.js
functions/routes/canvas.js
functions/routes/health.js
functions/routes/admin-auth.js
functions/routes/admin-panel.js
functions/routes/schedules.js
functions/routes/spots.js
functions/routes/rentals.js
```

### "firebase-functions: Please upgrade using npm install --save firebase-functions@latest"

This is a warning, not an error. Deployment still succeeds. To silence it:

```powershell
cd functions
npm install --save firebase-functions@latest
```

### "Error: Firebase Storage has not been set up"

Go to the Firebase Console > **Storage** and click **Get Started** to enable Firebase Storage before deploying storage rules.

### "Permission denied" or "403 Forbidden" on deploy

Your Firebase account may not have deployment permissions. Ask the project owner to add you as an **Editor** or **Owner** in:
- Firebase Console > **Project Settings** > **Users and permissions**
- OR Google Cloud Console > **IAM** > add your email with the `Firebase Admin` role

### "The requested URL returned error: 403" on git push

Your Git credentials don't have push access to the repository. Either:
1. Push to your own fork and create a pull request, OR
2. Ask the repo owner (`hwdbaek77`) to add your GitHub account as a collaborator

### Functions deploy times out or hangs

Functions deployment can take 2-5 minutes. If it seems stuck:
1. Wait at least 5 minutes before cancelling
2. Check your internet connection
3. Try again — transient failures happen occasionally
4. Check Firebase Console > **Functions** to see if the function was updated despite the CLI error

### ESLint errors preventing deploy

If you see ESLint errors during deploy, the predeploy hook may be running the linter. This has been removed from `firebase.json`, but if it returns, you can skip it by deploying without hooks:

```powershell
firebase deploy --only functions --force
```

## Verifying Deployment

After deploying, verify everything is working:

### 1. Test the API Root

```powershell
Invoke-RestMethod -Uri "https://us-central1-itandem-api.cloudfunctions.net/apiv2/"
```

You should see a JSON response listing all endpoints with `"status": "operational"`.

### 2. Test Health Check

```powershell
Invoke-RestMethod -Uri "https://us-central1-itandem-api.cloudfunctions.net/apiv2/health"
```

Should return `"status": "healthy"`.

### 3. Check the Admin Panel

Open https://itandem-api.web.app in a browser. You should see the landing page with links to the admin panel and test dashboard.

### 4. Check the Web App

Open https://itandem--itandem-api.us-central1.hosted.app in a browser. You should see the Next.js login page.

### 5. Check Function Logs

If something isn't working, check the logs:

```powershell
firebase functions:log
```

Or view them in the Firebase Console > **Functions** > **Logs**.

## Project URLs

| Service | URL |
|---------|-----|
| API | https://us-central1-itandem-api.cloudfunctions.net/apiv2 |
| Admin Panel | https://itandem-api.web.app/admin.html |
| Test Dashboard | https://itandem-api.web.app/test.html |
| Web App | https://itandem--itandem-api.us-central1.hosted.app |
| Firebase Console | https://console.firebase.google.com/project/itandem-api |

## Architecture Quick Reference

```
firebase deploy targets:
  functions  →  functions/index.js (Express API on Cloud Functions v2)
  hosting    →  public/ directory (static HTML admin panel + test UI)
  firestore  →  firestore.rules (database security rules)
  storage    →  storage.rules (PDF upload security rules)
  apphosting →  web/ directory (Next.js SSR app on Cloud Run)
```

The backend API is a single Cloud Function called `apiv2` that runs an Express.js app with 9 route modules. All requests go through `https://us-central1-itandem-api.cloudfunctions.net/apiv2/`.

---

**Last Updated**: February 24, 2026
