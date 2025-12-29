# Security Implementation & Fix Report

## 1. Issue Resolution: "No Authorization Header"
**Problem:** The frontend was receiving `401 Unauthorized` errors because certain pages were using the raw `fetch()` API, which does not automatically attach the Azure AD Bearer token.
**Fix:** Refactored the following files to use the centralized `api` service (`src/services/api.ts`), which includes an Axios interceptor to automatically inject the `Authorization: Bearer <token>` header.

### Modified Files:
- **`frontend/src/pages/Report.tsx`**
  - Replaced `fetch('${config.apiBaseUrl}/api/bc/projects')` with `api.get('/bc/projects')`.
  - Replaced `fetch('${config.apiBaseUrl}/api/bc/resources')` with `api.get('/bc/resources')`.
- **`frontend/src/pages/Glidepath.tsx`**
  - Replaced `fetch(...)` calls with `api.get(...)` and `api.post(...)`.

## 2. Security Verification
**Backend Protection:**
The backend (`backend/src/server.ts`) enforces security on all API routes using the following middleware chain:
1. `authMiddleware`: Validates the JWT (JSON Web Token) from Azure AD.
2. `requireViewer`: Enforces Role-Based Access Control (RBAC) to ensure the user has at least "Viewer" permissions.

**Code Evidence (`backend/src/server.ts`):**
```typescript
// All routes are protected
app.use('/api/projects', authMiddleware, requireViewer, projectsRouter);
app.use('/api/resources', authMiddleware, requireViewer, resourcesRouter);
// ...
app.use('/api/bc', authMiddleware, requireViewer, businessCentralRouter);
```

## 3. Testing Instructions
To verify the fix in your environment:
1. Start the backend: `cd backend` -> `npm run dev`
2. Start the frontend: `cd frontend` -> `npm run dev`
3. Log in to the application.
4. Navigate to the **Reports** page and **Glidepath** page.
5. Open the Browser Developer Tools (F12) -> **Network** tab.
6. Verify that requests to `/api/bc/...` now include the `Authorization` header in the Request Headers section.
