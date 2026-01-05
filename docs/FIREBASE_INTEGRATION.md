# Firebase Authentication Integration Guide

## Overview

The system has been migrated from Twilio OTP to Firebase Authentication. Firebase now handles all OTP generation, verification, expiry, and SMS delivery on the client side.

## What Changed

### ❌ Removed
- Twilio OTP service
- OTP generation logic
- OTP storage (`otp_verification` table)
- OTP expiry/attempts logic
- Backend OTP endpoints (`/login/request-otp`, `/login/verify-otp`)

### ✅ Added
- Firebase Admin SDK integration
- Firebase ID token verification
- `firebase_uid` column in users table
- New authentication endpoint: `/api/users/login/firebase`

## Backend Responsibilities

The backend now only:
1. Accepts Firebase ID token from client
2. Verifies token using Firebase Admin SDK
3. Extracts phone number from token
4. Creates/fetches user in PostgreSQL
5. Issues JWT token for API access

## Client Responsibilities

The client (mobile/web app) must:
1. Use Firebase SDK to request OTP
2. Send OTP via SMS (Firebase handles this)
3. User enters OTP
4. Firebase verifies OTP
5. Client receives Firebase ID token
6. Client sends ID token to backend

## Setup Instructions

### 1. Install Dependencies

```bash
npm install firebase-admin
```

### 2. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable **Phone Authentication**:
   - Go to Authentication → Sign-in method
   - Enable "Phone" provider
4. Get Service Account Key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download JSON file

### 3. Configure Environment Variables

Add to your `.env` file (choose one option):

**Option 1: Service Account JSON as String (Recommended)**
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project-id",...}
```

**Option 2: Service Account File Path**
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
```

**Option 3: Individual Credentials**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4. Run Database Migration

```bash
npm run migrate
```

This will:
- Add `firebase_uid` column to users table
- Remove `otp_verification` table
- Create index on `firebase_uid`

## API Endpoint

### Firebase Login

**Endpoint:** `POST /api/users/login/firebase`

**Headers:**
```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

**Request:** No body required (token in header)

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "your_jwt_token",
    "user": {
      "id": "user-uuid",
      "phone_number": "+1234567890",
      "name": null
    }
  }
}
```

**Error Responses:**
- `401`: Invalid or expired Firebase token
- `403`: Account is inactive
- `500`: Server error

## Client Implementation Example

### React Native / Expo

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Request OTP
const requestOTP = async (phoneNumber) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      new RecaptchaVerifier('recaptcha-container')
    );
    return confirmationResult;
  } catch (error) {
    console.error('Error requesting OTP:', error);
    throw error;
  }
};

// Verify OTP and get Firebase token
const verifyOTP = async (confirmationResult, otpCode) => {
  try {
    const result = await confirmationResult.confirm(otpCode);
    const firebaseToken = await result.user.getIdToken();
    return firebaseToken;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

// Send Firebase token to backend
const loginWithBackend = async (firebaseToken) => {
  try {
    const response = await fetch('http://your-api.com/api/users/login/firebase', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Store JWT token for API calls
      await AsyncStorage.setItem('jwt_token', data.data.token);
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error logging in with backend:', error);
    throw error;
  }
};

// Complete flow
const completeLogin = async (phoneNumber, otpCode) => {
  // Step 1: Request OTP (client-side)
  const confirmationResult = await requestOTP(phoneNumber);
  
  // Step 2: Verify OTP (client-side)
  const firebaseToken = await verifyOTP(confirmationResult, otpCode);
  
  // Step 3: Send to backend
  const userData = await loginWithBackend(firebaseToken);
  
  return userData;
};
```

## Migration from Old System

### For Existing Users

Existing users will be automatically migrated:
- When they log in with Firebase, their `firebase_uid` will be set
- Phone number remains the same
- All ride history is preserved

### Database Changes

The migration script:
1. Adds `firebase_uid` column (nullable, unique)
2. Drops `otp_verification` table
3. Creates index on `firebase_uid`

## Security Notes

1. **Firebase handles:**
   - OTP generation
   - Rate limiting
   - Expiry management
   - Abuse prevention
   - SMS delivery

2. **Backend verifies:**
   - Firebase token authenticity
   - Token expiration
   - Phone number extraction
   - User account status

3. **JWT tokens:**
   - Issued by backend after Firebase verification
   - Used for all API requests
   - Contains user ID and role

## Troubleshooting

### Firebase Initialization Error

**Error:** "Firebase configuration not found"

**Solution:** Check your `.env` file has one of:
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- Individual credentials (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY)

### Token Verification Fails

**Error:** "Invalid Firebase token"

**Possible causes:**
- Token expired (Firebase tokens expire after 1 hour)
- Wrong project credentials
- Token not from Firebase

**Solution:** Client should refresh token and retry

### Phone Number Not Found

**Error:** "Phone number not found in Firebase token"

**Solution:** Ensure Firebase Phone Authentication is properly configured and user completed phone verification

## Benefits of Firebase Authentication

1. ✅ **No OTP management** - Firebase handles everything
2. ✅ **Better security** - Firebase's proven OTP system
3. ✅ **Reduced backend code** - Less to maintain
4. ✅ **Automatic rate limiting** - Firebase prevents abuse
5. ✅ **Global SMS delivery** - Firebase handles international numbers
6. ✅ **Free tier available** - Cost-effective for startups

## Support

For Firebase-specific issues, refer to:
- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
