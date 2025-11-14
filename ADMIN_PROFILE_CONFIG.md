# Admin Profile Configuration

## Problem
The Render free tier uses in-memory database that resets on every deploy. This means admin profile changes are lost when the server restarts.

## Solution
Admin profile data can now be persisted using environment variables. Set these variables in your Render dashboard to maintain admin profile across deployments.

## Environment Variables

Add these to your Render service environment variables:

### Required
- `DEFAULT_ADMIN_PASSWORD` - Admin login password (default: admin123)

### Optional Profile Fields
- `ADMIN_FIRST_NAME` - First name (default: Admin)
- `ADMIN_LAST_NAME` - Last name (default: User)
- `ADMIN_BIO` - Biography text
- `ADMIN_LOCATION` - Location/address
- `ADMIN_PHONE` - Phone number  
- `ADMIN_WEBSITE` - Website URL
- `ADMIN_PHOTO` - Profile photo URL
- `ADMIN_INSTAGRAM` - Instagram username
- `ADMIN_FACEBOOK` - Facebook profile
- `ADMIN_STRAVA` - Strava profile

## Example Configuration

In Render dashboard, add environment variables:
```
DEFAULT_ADMIN_PASSWORD=your_secure_password
ADMIN_FIRST_NAME=Mario
ADMIN_LAST_NAME=Rossi
ADMIN_BIO=Amministratore della community Singletrack
ADMIN_LOCATION=Milano, Italia
ADMIN_PHONE=+39 123 456 7890
ADMIN_WEBSITE=https://singletrack.it
ADMIN_INSTAGRAM=singletrack_official
```

## How It Works

1. On server startup, `initializeAdminWithProfile()` checks if admin exists
2. If admin doesn't exist, creates one with environment variable values
3. If admin exists, updates profile fields that have changed
4. Profile data persists across deployments via environment variables

## Manual Update

To update admin profile after setting environment variables:
1. Go to Render dashboard
2. Navigate to your service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Admin profile will be updated on restart

## Security Note

Environment variables are secure and not exposed in code. Set sensitive data like password and phone numbers only in the Render dashboard, never commit them to Git.