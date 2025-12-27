# Microsoft Entra Authentication Setup Guide

This guide will help you configure Microsoft Entra (Azure AD) authentication for your Stalo application, allowing users to sign in with their Microsoft account.

## 📋 Prerequisites

- Access to [Azure Portal](https://portal.azure.com)
- An existing App Registration in Microsoft Entra ID
- Admin permissions to configure the app registration

---

## 🔧 Step 1: Configure Azure App Registration

### 1.1 Get Your Configuration Values

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations**
3. Select your app registration
4. From the **Overview** page, copy these values:
   - **Application (client) ID** - you'll need this for `VITE_MSAL_CLIENT_ID`
   - **Directory (tenant) ID** - you'll need this for `VITE_MSAL_TENANT_ID`

### 1.2 Configure Authentication Settings

1. In your App Registration, go to **Authentication** in the left menu
2. Click **Add a platform**
3. Select **Single-page application (SPA)**
4. Add the following Redirect URIs:
   ```
   http://localhost:5173
   https://yourdomain.com (your production URL)
   ```
5. Add the following Logout redirect URIs:
   ```
   http://localhost:5173
   https://yourdomain.com (your production URL)
   ```
6. Under **Implicit grant and hybrid flows**, enable:
   - ✅ Access tokens (used for implicit flows)
   - ✅ ID tokens (used for implicit and hybrid flows)
7. Click **Save**

### 1.3 Configure API Permissions

1. Go to **API permissions** in the left menu
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `User.Read` - Read user profile
   - `openid` - OpenID Connect sign-in
   - `profile` - View user's basic profile
   - `email` - View user's email address
6. Click **Add permissions**
7. If required by your organization, click **Grant admin consent for [your organization]**

### 1.4 Supported Account Types (Optional)

1. Go to **Authentication**
2. Under **Supported account types**, choose:
   - **Accounts in this organizational directory only** - Single tenant (only your organization)
   - **Accounts in any organizational directory** - Multi-tenant (any Azure AD organization)
   - **Accounts in any organizational directory and personal Microsoft accounts** - Multi-tenant + personal accounts

---

## ⚙️ Step 2: Configure Your Application

### 2.1 Update Frontend Environment Variables

1. Open the file `frontend/.env.local`
2. Fill in your values from Azure:

```env
# Application (Client) ID from Azure App Registration
VITE_MSAL_CLIENT_ID=your-client-id-here

# Directory (Tenant) ID from Azure App Registration
# Use your specific tenant ID for single-tenant apps
# Use 'common' for multi-tenant apps
VITE_MSAL_TENANT_ID=your-tenant-id-here

# Redirect URIs (must match what's configured in Azure)
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_MSAL_LOGOUT_REDIRECT_URI=http://localhost:5173
```

### 2.2 Example Configuration

```env
# Example values (replace with your actual values)
VITE_MSAL_CLIENT_ID=12345678-1234-1234-1234-123456789abc
VITE_MSAL_TENANT_ID=87654321-4321-4321-4321-cba987654321
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_MSAL_LOGOUT_REDIRECT_URI=http://localhost:5173
```

---

## 🚀 Step 3: Start Your Application

### 3.1 Start the Frontend

```powershell
cd frontend
npm install
npm run dev
```

The application will start on `http://localhost:5173`

### 3.2 Test Authentication

1. Navigate to the **Report** page in your application
2. Click the **"Connect to BC"** button
3. You'll be redirected to Microsoft login page
4. Sign in with your Microsoft account
5. Grant consent if prompted
6. You'll be redirected back to your application
7. You should see your name displayed and the button changes to **"Disconnect"**

---

## ✅ Verification Checklist

After completing the setup, verify:

- [ ] Application (Client) ID is correctly set in `.env.local`
- [ ] Tenant ID is correctly set in `.env.local`
- [ ] Redirect URIs match exactly between Azure and `.env.local`
- [ ] Single-page application platform is configured in Azure
- [ ] Required API permissions are added and consented
- [ ] Frontend dev server has been restarted after `.env.local` changes
- [ ] Login button appears on the Report page
- [ ] Clicking login redirects to Microsoft login page
- [ ] After login, user name is displayed in the application

---

## 🔍 How Authentication Works

Your application uses **Microsoft Authentication Library (MSAL)** with the following flow:

1. **User clicks "Connect to BC"** button
2. **MSAL redirects** to Microsoft login page
3. **User signs in** with their Microsoft account
4. **Microsoft redirects back** to your app with an authorization code
5. **MSAL exchanges** the code for an access token
6. **Token is stored** in session storage
7. **User is authenticated** and can access protected features

---

## 🎯 Where Authentication is Used

The authentication is integrated in the following places:

### Frontend Components

- **AuthContext** ([frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx))
  - Provides authentication state to entire app
  - Exposes `isAuthenticated`, `login()`, `logout()`, `userDisplayName`, etc.

- **AuthService** ([frontend/src/services/authService.ts](frontend/src/services/authService.tsx))
  - Handles MSAL initialization and token management
  - Provides methods for login, logout, and token acquisition

### Using Authentication in Your Components

To add authentication to any component:

```tsx
import { useAuth } from '../contexts/AuthContext';

export default function MyComponent() {
  const { isAuthenticated, login, logout, userDisplayName, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {userDisplayName}!</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={login}>Login with Microsoft</button>
      )}
    </div>
  );
}
```

---

## 🛠️ Troubleshooting

### Error: "MSAL Client ID not configured"

**Solution:** Make sure `VITE_MSAL_CLIENT_ID` is set in `frontend/.env.local` and restart the dev server.

### Error: "Redirect URI mismatch"

**Solution:** The redirect URI in `.env.local` must exactly match what's configured in Azure App Registration.

### Error: "User cancelled login"

**Solution:** This is normal - the user simply closed the login popup or clicked cancel.

### Error: "Grant admin consent required"

**Solution:** In Azure, go to API permissions and click "Grant admin consent for [your organization]".

### Login popup is blocked

**Solution:** Allow popups for your application in your browser settings. Alternatively, you can configure redirect-based login instead of popup.

---

## 🌐 Production Deployment

When deploying to production:

1. **Update Redirect URIs** in Azure App Registration:
   ```
   https://yourdomain.com
   ```

2. **Update environment variables** for production:
   ```env
   VITE_MSAL_CLIENT_ID=your-client-id
   VITE_MSAL_TENANT_ID=your-tenant-id
   VITE_MSAL_REDIRECT_URI=https://yourdomain.com
   VITE_MSAL_LOGOUT_REDIRECT_URI=https://yourdomain.com
   ```

3. **Rebuild your frontend**:
   ```powershell
   cd frontend
   npm run build
   ```

---

## 📚 Additional Resources

- [Microsoft Entra Documentation](https://learn.microsoft.com/en-us/entra/)
- [MSAL.js Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Azure App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

## 💡 Quick Commands Reference

```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

**Need Help?** If you encounter any issues, check the browser console for detailed error messages from MSAL.
