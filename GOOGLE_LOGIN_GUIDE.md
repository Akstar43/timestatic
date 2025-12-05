# Google Login with Admin-Controlled Accounts

## Overview
This system implements Google authentication where **only admin-registered users** can sign in. This prevents unauthorized account creation while still leveraging Google's secure authentication.

## How It Works

### 1. **Admin Creates User Accounts**
The admin must first create user accounts through the Admin Panel:

1. Navigate to **Admin Panel** → **Users & Organizations**
2. Fill in the **Create New User** form:
   - **Full Name**: User's display name
   - **Email Address**: Must be the user's Google email
   - **Password**: Temporary password (can be any value, won't be used for Google login)
   - **Role**: Select "User" or "Admin"
3. Click **Create User**

**Important**: The email address must match the Google account email the user will use to sign in.

### 2. **User Signs In with Google**
Once the admin has created their account:

1. User goes to the login page
2. Selects the appropriate portal (User Portal or Admin Portal)
3. Clicks **"Sign in with Google"**
4. Authenticates with their Google account
5. System checks if their email exists in the database
6. If registered → User is logged in
7. If not registered → Access denied with message: "Your email is not registered. Please contact your administrator."

### 3. **Authentication Flow**

```
User clicks "Sign in with Google"
    ↓
Google authentication popup
    ↓
User authenticates with Google
    ↓
System checks: Does user.email exist in database?
    ↓
    ├─ YES → Update UID & photo → Navigate to dashboard
    └─ NO  → Show error: "Email not registered"
```

## Key Features

### ✅ **Security Benefits**
- Only pre-approved users can access the system
- Admin has full control over who can sign in
- Google handles password security
- No unauthorized account creation

### ✅ **User Experience**
- Users don't need to remember passwords
- Fast, one-click Google authentication
- Profile pictures automatically synced from Google
- Seamless login experience

### ✅ **Admin Control**
- Create users before they can access the system
- Assign roles (User/Admin) during creation
- Manage user permissions centrally
- Track all registered users

## Technical Implementation

### Database Structure
When admin creates a user:
```javascript
{
  email: "user@example.com",      // Required - must match Google email
  name: "John Doe",                // User's display name
  role: "user",                    // "user" or "admin"
  leaveDaysAssigned: 0,            // Leave balance
  organizationName: "",            // Organization assignment
  workingDays: [],                 // Working schedule
  createdAt: timestamp,            // Account creation time
  uid: null,                       // Set on first Google login
  photoURL: ""                     // Set on first Google login
}
```

### First-Time Google Login
When a registered user signs in with Google for the first time:
1. System finds their account by email
2. Updates the document with:
   - `uid`: Google user ID
   - `photoURL`: Google profile picture
   - `name`: Uses Google display name if not set

### Subsequent Logins
- System verifies email exists in database
- Checks role matches selected portal
- Grants access immediately

## Workflow Examples

### Example 1: Adding a New Employee
1. **Admin**: Create account with email `john@company.com`
2. **Admin**: Assign 20 leave days, set organization
3. **Email John**: "Your account is ready. Sign in at [app-url] using Google"
4. **John**: Clicks "Sign in with Google" → Instant access

### Example 2: Unauthorized Access Attempt
1. **Random person**: Tries to sign in with their Google account
2. **System**: Checks database → Email not found
3. **System**: Shows error → Access denied
4. **Result**: No account created, no access granted

## Admin Best Practices

### ✅ **Do's**
- Create user accounts before informing employees
- Use the exact Google email address
- Assign appropriate roles and permissions
- Set leave balances and organizations upfront

### ❌ **Don'ts**
- Don't use non-Google email addresses
- Don't create duplicate accounts
- Don't forget to assign organizations
- Don't leave default values for important fields

## Troubleshooting

### User Can't Sign In
**Problem**: "Access denied: Your email is not registered"
**Solution**: 
1. Check if admin created the account
2. Verify email matches exactly (case-sensitive)
3. Ensure user is using the correct Google account

### Wrong Portal Error
**Problem**: "Please use the correct portal for your role"
**Solution**: 
- Admin users → Use "Admin Portal"
- Regular users → Use "User Portal"

### Google Sign-In Fails
**Problem**: "Google sign-in failed. Please try again."
**Solution**:
1. Check internet connection
2. Ensure pop-ups are not blocked
3. Try different browser
4. Clear browser cache

## Migration from Old System

If you previously had auto-registration enabled:

1. **Existing users**: Already have accounts, will continue working
2. **New users**: Must be created by admin first
3. **Database**: No changes needed to existing user documents
4. **Security**: Immediately improved - no more unauthorized access

## Code Changes Summary

### Modified: `login.jsx`
- Changed Google login to check email (not UID)
- Removed automatic user creation
- Added access denial for unregistered emails
- Added role verification for portal access
- Updates UID and photo on first Google login

### Admin Panel: `admin.jsx`
- No changes needed
- Existing user creation flow works perfectly
- Admin can create users with any email

## Future Enhancements

Potential improvements:
- Email verification for new accounts
- Bulk user import from CSV
- User invitation system with email notifications
- Self-service password reset (for non-Google login)
- Multi-factor authentication
- SSO integration with other providers

---

**Last Updated**: December 2025
**System Version**: 2.0
