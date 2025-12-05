# 🚀 QUICK FIX - Create Your First Admin User

## The Problem
You're getting "Access denied: Your email is not registered" because your email doesn't exist in the Firestore database yet.

## ✅ EASIEST SOLUTION - Use the Setup Page

I've created a special setup page for you. Follow these simple steps:

### Step 1: Navigate to the Setup Page
In your browser, go to:
```
http://localhost:3000/setup-admin
```

### Step 2: Create Your Admin Account
You have two options:

**Option A: Email & Password**
1. Enter your full name
2. Enter your email address
3. Enter a password (minimum 6 characters)
4. Click "Create Admin User"

**Option B: Google Sign-In**
1. Click "Create Admin with Google"
2. Sign in with your Google account
3. Done!

### Step 3: Login
After creating your admin account:
1. You'll be redirected to the login page
2. Select "Admin Portal"
3. Enter your credentials
4. You should now have access to the admin panel! 🎉

## What This Does
The setup page will:
- ✅ Create a Firebase Authentication account
- ✅ Add your user to Firestore with `role: "admin"`
- ✅ Set up all required fields
- ✅ Redirect you to login

## After Setup
Once you successfully log in as admin:
- You can create more users through the admin panel
- You can assign admin or user roles to new users
- You won't need the setup page anymore

## Troubleshooting

### "Email already in use"
- The email is already registered in Firebase Auth
- Try logging in instead of creating a new account
- Or use a different email

### Still getting "Access denied"?
- Make sure you selected "Admin Portal" on the login page
- Try clearing browser cache and logging in again
- Check if the user was created in Firestore (Firebase Console → Firestore Database → users collection)

## Manual Method (If Setup Page Doesn't Work)

If for some reason the setup page doesn't work, you can create the admin user manually:

1. **Firebase Console → Authentication**
   - Add a new user with your email/password
   - Copy the UID

2. **Firebase Console → Firestore Database**
   - Go to `users` collection
   - Add a document with these fields:
     - `uid`: [paste UID from step 1]
     - `email`: your-email@example.com
     - `name`: Your Name
     - `role`: "admin" (must be lowercase)
     - `leaveDaysAssigned`: 0
     - `workingDays`: []
     - `organizationName`: ""
     - `photoURL`: ""
     - `createdAt`: [timestamp]

## Need Help?
If you're still having issues, let me know and I can help debug further!
