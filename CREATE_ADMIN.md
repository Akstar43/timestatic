# How to Create Your First Admin User

## Problem
You're getting "Access denied: Your email is not registered" because your email doesn't exist in the Firestore `users` collection yet.

## Solution: Create Admin User Manually in Firebase Console

### Step 1: Create Firebase Auth Account (if not already created)
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: **timestatic-77f36**
3. Go to **Authentication** → **Users** tab
4. If your email is not listed:
   - Click **Add user**
   - Enter your email and password
   - Click **Add user**
5. **Copy the UID** of your user (you'll need this in Step 2)

### Step 2: Add User to Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click on the **users** collection (or create it if it doesn't exist)
3. Click **Add document**
4. Set **Document ID** to: `auto-generate` or any ID you want
5. Add these fields:

```
Field Name          | Type    | Value
--------------------|---------|----------------------------------
uid                 | string  | [Paste the UID from Step 1]
email               | string  | your-email@example.com
name                | string  | Your Name
role                | string  | admin
leaveDaysAssigned   | number  | 0
workingDays         | array   | [] (empty array)
organizationName    | string  | (leave empty)
photoURL            | string  | (leave empty)
createdAt           | timestamp | (click "Add field" → select timestamp → use current time)
```

6. Click **Save**

### Step 3: Try Logging In Again
1. Go to your app login page
2. Select **"Admin Portal"**
3. Enter the email and password you created in Step 1
4. You should now be able to access the admin panel!

## Quick Visual Guide

### Firebase Console → Authentication
```
Authentication
  └── Users
      └── Add user
          ├── Email: your-email@example.com
          ├── Password: your-password
          └── [Add user]
      
      Copy the UID from the user list!
```

### Firebase Console → Firestore
```
Firestore Database
  └── users (collection)
      └── Add document
          ├── uid: "paste-uid-here"
          ├── email: "your-email@example.com"
          ├── name: "Your Name"
          ├── role: "admin"  ← IMPORTANT!
          ├── leaveDaysAssigned: 0
          ├── workingDays: []
          ├── organizationName: ""
          ├── photoURL: ""
          └── createdAt: [timestamp]
```

## Alternative: Temporary Admin Bypass

If you want to bypass the check temporarily to access the admin panel, I can add a temporary bypass for your email. Just let me know your email address and I'll add it to the code temporarily so you can create users through the admin panel.

## After You Get Access

Once you successfully log in to the admin panel:
1. Go to **Users & Organizations** tab
2. You can now create more users (admin or regular users)
3. All future users can be created through the UI!

## Troubleshooting

### "User not found in database"
- You created the Firebase Auth account but forgot to add the user to Firestore
- Solution: Complete Step 2 above

### "Access denied: You don't have admin privileges"
- You added the user to Firestore but the `role` field is not "admin"
- Solution: Edit the user document in Firestore and change `role` to "admin"

### "Invalid email or password"
- Wrong credentials
- Solution: Reset password in Firebase Console → Authentication

### Still not working?
- Make sure the `uid` in Firestore matches the UID in Firebase Authentication
- Make sure the `email` in Firestore matches exactly (case-sensitive)
- Make sure `role` is exactly "admin" (lowercase)
- Try clearing browser cache and logging in again
