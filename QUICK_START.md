# iTandem Backend - Quick Start Guide

This guide will get you up and running with the iTandem backend in minutes.

## ✅ Prerequisites Checklist

You've already completed:
- ✅ Firebase CLI installed and logged in
- ✅ Firebase project initialized (hosting, functions, authentication, Firestore)
- ✅ Backend code created and committed to `API-Auth` branch

## 🚀 Next Steps

### 1. Install Dependencies

```powershell
cd functions
npm install
```

This will install all required packages:
- firebase-admin, firebase-functions
- express, cors
- axios (for Canvas API)
- crypto (for API key generation)

### 2. Configure Environment Variables

```powershell
cd functions
Copy-Item .env.example .env
```

Now edit `.env` and add your secrets:

```env
CANVAS_API_BASE_URL=https://canvas.instructure.com/api/v1
CANVAS_API_KEY=349~EGanBHzF6tRenP96FVaAFYDGkExutYnzfhYmrhBBDKuZ4XXyF3XRywf73YBmGaaU
JWT_SECRET=generate_a_secure_random_string_here
NODE_ENV=development
```

**Security Note**: Never commit the `.env` file! It's already in `.gitignore`.

### 3. Update Firebase Configuration in Test Interface

Edit `public/app.js` and replace the Firebase config (lines 2-8) with your project's configuration:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

To get your config:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → Project Settings
4. Scroll down to "Your apps" → Web app
5. Copy the config object

### 4. Deploy Firestore Rules and Indexes

```powershell
firebase deploy --only firestore
```

This deploys:
- Security rules (`firestore.rules`)
- Database indexes (`firestore.indexes.json`)

### 5. Start Local Development Server

```powershell
firebase emulators:start
```

This starts:
- **Functions**: http://localhost:5001
- **Firestore UI**: http://localhost:4000/firestore
- **Auth UI**: http://localhost:4000/auth
- **Hosting**: http://localhost:5000 (test dashboard)

### 6. Test the System

Open http://localhost:5000 in your browser to access the test dashboard.

#### Test Flow:

1. **Create an Account**
   - Fill in the signup form
   - Click "Sign Up"
   - You'll be automatically logged in

2. **Link Canvas Account**
   - Click "Link Canvas Account"
   - Paste your Canvas API token: `349~EGanBHzF6tRenP96FVaAFYDGkExutYnzfhYmrhBBDKuZ4XXyF3XRywf73YBmGaaU`
   - Click "Link Canvas Account"
   - Wait for data to be fetched (~5-10 seconds)

3. **View Canvas Data**
   - Click "View My Courses" to see your Canvas courses
   - Click "View Schedule" to see upcoming events
   - Click "Refresh Canvas Data" to update the cache

4. **Generate Mobile App API Key**
   - Click "Generate New API Key"
   - **IMPORTANT**: Copy and save the key immediately
   - Test it with cURL or Postman

5. **Check Platform Health**
   - Click "Detailed Health Check"
   - Verify all services are healthy
   - Click "Load Stats" to see platform statistics

## 🔑 Testing with API Key

Once you have an API key, test it with PowerShell:

```powershell
# Get your profile using API key
curl http://localhost:5001/itandem-firebase/us-central1/api/users/me `
  -H "x-api-key: your_api_key_here"

# Get Canvas courses using API key
curl http://localhost:5001/itandem-firebase/us-central1/api/canvas/courses `
  -H "x-api-key: your_api_key_here"
```

## 📱 Mobile App Integration

Your mobile app can authenticate using API keys:

```javascript
// Example: React Native / Expo
const API_BASE_URL = 'https://your-project.web.app/api';
const API_KEY = 'user_generated_api_key';

fetch(`${API_BASE_URL}/users/me`, {
  headers: {
    'x-api-key': API_KEY
  }
})
  .then(res => res.json())
  .then(data => console.log(data.user));
```

## 🚢 Deploy to Production

When ready to deploy:

```powershell
# Deploy everything
firebase deploy

# Or deploy individually
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore
```

Your API will be available at:
- Production: `https://your-project.web.app/api`

## 📊 Monitoring After Deployment

### View Function Logs

```powershell
firebase functions:log
```

### Firebase Console

- [Functions Dashboard](https://console.firebase.google.com/project/_/functions)
- [Firestore Database](https://console.firebase.google.com/project/_/firestore)
- [Authentication](https://console.firebase.google.com/project/_/authentication)
- [Usage & Billing](https://console.firebase.google.com/project/_/usage)

## 🔧 Common Issues

### Issue: "Firebase command not found"
**Solution**: Install Firebase CLI globally
```powershell
npm install -g firebase-tools
firebase login
```

### Issue: "Permission denied" in Firestore
**Solution**: Check `firestore.rules` and ensure you're authenticated
```powershell
firebase deploy --only firestore:rules
```

### Issue: Functions timeout
**Solution**: Increase timeout in `firebase.json`
```json
"functions": [{
  "timeoutSeconds": 60,
  "memory": "256MB"
}]
```

### Issue: Canvas API returns 401
**Solution**: Your Canvas token may be invalid or expired
- Generate a new token from Canvas
- Update it via the test dashboard

### Issue: CORS errors in browser
**Solution**: CORS is already configured in `functions/index.js`
- Check that `cors({ origin: true })` is present
- Redeploy functions: `firebase deploy --only functions`

## 📚 Next Steps

Now that your backend is running:

1. **Create Admin Account**
   - Signup normally in the test dashboard
   - Manually update Firestore: set `userType: "ADMIN"` for your user
   - Or use Firebase Console → Firestore → users → [your-user-id] → Edit

2. **Test All Endpoints**
   - Review `README_BACKEND.md` for complete API documentation
   - Test each endpoint with the dashboard or Postman

3. **Setup Mobile App**
   - Use the generated API key
   - Implement authentication flow
   - Test all user endpoints

4. **Implement Tandem/Carpool Algorithms**
   - Use Canvas schedule data from `/canvas/schedule-info`
   - Implement compatibility scoring
   - Create matching endpoints

5. **Add Parking Spot Management**
   - Create admin interface for adding spots
   - Implement rental booking system
   - Add payment integration (Stripe)

## 🎯 Architecture Overview

```
User/Mobile App
    ↓
Firebase Auth / API Key
    ↓
Cloud Functions (Express API)
    ↓
    ├─→ Firestore (User Data, Parking, Tandems, etc.)
    ├─→ Canvas LMS API (Schedule Data)
    └─→ [Future: DIDAX SSO, Stripe, etc.]
```

## 📖 Additional Documentation

- **Complete API Reference**: See `README_BACKEND.md`
- **Canvas LMS API**: https://developerdocs.instructure.com/services/canvas
- **Firebase Docs**: https://firebase.google.com/docs
- **Express.js**: https://expressjs.com/

## ✅ Checklist Before Going Live

- [ ] Replace all "YOUR_*" placeholders in configs
- [ ] Generate production JWT secret (use crypto.randomBytes)
- [ ] Enable Firebase production billing plan
- [ ] Setup custom domain for hosting
- [ ] Enable Firebase Security Rules
- [ ] Encrypt Canvas tokens at rest
- [ ] Implement rate limiting
- [ ] Setup monitoring and alerts
- [ ] Create backup strategy for Firestore
- [ ] Test on production Firebase project

## 🆘 Need Help?

1. Check `README_BACKEND.md` for detailed documentation
2. View Firebase Function logs: `firebase functions:log`
3. Check browser console for frontend errors
4. Review Firestore rules if getting permission errors
5. Verify API endpoints are correct for your environment

---

**Happy Coding! 🚗💨**
