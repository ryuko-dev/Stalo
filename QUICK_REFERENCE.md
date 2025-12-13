# Quick Reference: OAuth2 + Business Central Integration

## 🚀 Quick Start

### 1. Configure Environment (2 min)
```bash
# Open frontend/.env.local and fill in:
VITE_MSAL_CLIENT_ID=<from Azure Portal>
VITE_MSAL_TENANT_ID=<from Azure Portal>
VITE_MSAL_REDIRECT_URI=http://localhost:5173
VITE_MSAL_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_BC_TENANT_ID=9f4e2976-b07e-4f8f-9c78-055f6c855a11
```

### 2. Start Development Server (1 min)
```bash
cd frontend
npm run dev
```

### 3. Test OAuth2 (30 sec)
- Navigate to http://localhost:3002
- Go to Projects page
- Click "Connect to BC"
- Sign in with your Azure credentials

---

## 📚 Core Components

### Authentication Service
```typescript
// File: frontend/src/services/authService.ts

import { 
  initMsal, 
  loginPopup, 
  logout, 
  getAccessToken, 
  isAuthenticated, 
  getCurrentAccount 
} from '../services/authService';

// Login
await loginPopup();

// Logout
await logout();

// Get token (auto-refreshes if needed)
const token = await getAccessToken();

// Check auth status
const authed = isAuthenticated();
```

### React Context Hook
```typescript
// File: frontend/src/contexts/AuthContext.tsx

import { useAuth } from '../contexts/AuthContext';

export function MyComponent() {
  const { 
    isAuthenticated,    // boolean
    isLoading,          // boolean (during login)
    user,               // AccountInfo | null
    userDisplayName,    // string
    userEmail,          // string
    login,              // () => Promise<void>
    logout,             // () => Promise<void>
    error,              // string | null
    clearError          // () => void
  } = useAuth();

  return (
    <button onClick={login}>
      {isAuthenticated ? 'Logout' : 'Login'}
    </button>
  );
}
```

### Business Central OData Service
```typescript
// File: frontend/src/services/businessCentralService.ts

import { BusinessCentralService } from '../services/businessCentralService';

// Create instance
const bcService = new BusinessCentralService(
  tenantId,      // '9f4e2976-b07e-4f8f-9c78-055f6c855a11'
  environment,   // 'Production'
  company        // 'ARK Group Live'
);

// Built-in methods (auto-inject token)
const projects = await bcService.getProjects();
const invoices = await bcService.getPurchaseInvoices();
const sales = await bcService.getSalesInvoices();
const glEntries = await bcService.getGeneralLedgerEntries();

// Generic method with OData filtering
const filtered = await bcService.fetchEntity(
  'Purchase_Invoices',  // Entity name
  "PostingDate ge 2024-01-01",  // Filter
  'No,Vendor_Name,Amount'       // Select (optional)
);
```

---

## 🔧 Common Tasks

### Add Login Button to Any Page
```typescript
import { useAuth } from '../contexts/AuthContext';
import { Button, Chip } from '@mui/material';
import { CloudSync as CloudSyncIcon } from '@mui/icons-material';

export function MyPage() {
  const { isAuthenticated, login, logout, userDisplayName, isLoading } = useAuth();

  return (
    <div>
      {isAuthenticated && (
        <Chip label={`Connected: ${userDisplayName}`} color="success" />
      )}
      <Button 
        onClick={() => isAuthenticated ? logout() : login()}
        disabled={isLoading}
        startIcon={<CloudSyncIcon />}
      >
        {isLoading ? 'Connecting...' : isAuthenticated ? 'Disconnect' : 'Connect'}
      </Button>
    </div>
  );
}
```

### Fetch Business Central Data
```typescript
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BusinessCentralService } from '../services/businessCentralService';

export function ReportPage() {
  const { isAuthenticated } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['bcProjects'],
    queryFn: async () => {
      const bcService = new BusinessCentralService(
        '9f4e2976-b07e-4f8f-9c78-055f6c855a11',
        'Production',
        'ARK Group Live'
      );
      return bcService.getProjects();
    },
    enabled: isAuthenticated  // Only fetch when logged in
  });

  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {projects?.map(p => (
        <div key={p.No}>{p.Name} - {p.Status}</div>
      ))}
    </div>
  );
}
```

### Handle Token Refresh Automatically
```typescript
// No special code needed! The interceptor handles it automatically.
// If a request gets 401:
// 1. Automatically refreshes the token silently
// 2. Retries the original request with new token
// 3. Logs any errors

// Your code just calls:
const data = await bcService.getProjects();
// Token refresh happens transparently
```

---

## 🧪 Testing Checklist

- [ ] Environment variables filled in `.env.local`
- [ ] Azure App Registration created
- [ ] Client ID and Tenant ID in `.env.local`
- [ ] API permissions granted in Azure
- [ ] `npm run dev` starts without errors
- [ ] App loads at http://localhost:3002
- [ ] Can click "Connect to BC" button on Projects page
- [ ] Redirected to Microsoft login
- [ ] Can successfully sign in
- [ ] Button changes to "Disconnect"
- [ ] User name appears in green chip
- [ ] Can click "Disconnect" to logout

---

## 📁 File Structure Reference

```
frontend/
├── src/
│   ├── services/
│   │   ├── authService.ts              ← MSAL OAuth2
│   │   ├── businessCentralService.ts   ← OData client
│   │   └── staloService.ts             ← Local API
│   ├── contexts/
│   │   └── AuthContext.tsx             ← Auth state
│   ├── pages/
│   │   ├── Projects.tsx                ← "Connect to BC" button
│   │   └── Report.tsx                  ← Empty, ready to build
│   └── App.tsx                         ← AuthProvider wrapper
└── .env.local                          ← Configuration
```

---

## 🐛 Troubleshooting

### "Cannot find module @azure/msal-browser"
```bash
npm install @azure/msal-browser --legacy-peer-deps
```

### Dev server won't start
```bash
# Kill any existing node processes
# Then:
npm install
npm run dev
```

### Login button not working
1. Check `.env.local` has VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID
2. Check Azure App Registration has correct Redirect URI
3. Check browser console for errors (F12)

### Getting "MSAL redirect error"
- This is normal during development
- Check browser console for actual error message
- Usually means Azure credentials are missing or incorrect

### OData call failing with 401
- Token refresh should handle this automatically
- If persists, check:
  - Azure App has Business Central permissions
  - Admin granted consent to permissions
  - VITE_BC_TENANT_ID is correct

---

## 📞 Key Contact Points

- **MSAL Docs**: https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-browser-use-cases
- **Business Central OData**: https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/
- **Azure App Registration**: https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app

---

## ✅ Implementation Status

- ✅ MSAL authentication service
- ✅ Business Central OData client  
- ✅ React authentication context
- ✅ App-wide authentication wrapper
- ✅ UI integration (Projects page)
- ✅ Token refresh mechanism
- ✅ Error handling
- ⏳ Azure credentials (user provides)
- ⏳ Report page build (next phase)

