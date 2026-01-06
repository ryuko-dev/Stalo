# User Access Fix - Role Naming Mismatch

## Problem
Users were unable to access the system even after being assigned roles through the System Users section. They saw the "Access Pending" / "No Access" page.

## Root Cause
There was a **role naming mismatch** between the frontend and backend:

- **Backend RBAC** (`backend/src/middleware/rbac.ts`): Expected `'BudgetManager'` (no space)
- **Frontend** (`frontend/src/types/systemUsers.ts`): Used `'Budget Manager'` (with space)

When administrators assigned roles through the frontend, the role was saved as "Budget Manager" in the database. However, the backend RBAC middleware was looking for "BudgetManager" (no space), causing the role check to fail and denying access.

## Changes Made

### 1. Frontend Role Name Updates
Fixed the following files to use `'BudgetManager'` instead of `'Budget Manager'`:

- ✅ `frontend/src/types/systemUsers.ts` - Updated RoleType definition
- ✅ `frontend/src/contexts/PermissionsContext.tsx` - Updated role check
- ✅ `frontend/src/pages/Settings.tsx` - Updated role options and display

### 2. Backend Role Cache Clearing
- ✅ `backend/src/routes/systemUsers.ts` - Added `clearRoleCache()` call when roles are updated
  - This ensures role changes take effect immediately instead of waiting for the 5-minute cache TTL
  - Imported `clearRoleCache` from RBAC middleware

### 3. Database Migration Script
Created migration scripts to fix existing users in the database:

- ✅ `backend/scripts/fix-budget-manager-role.sql` - SQL script
- ✅ `backend/scripts/fix-budget-manager-role.js` - Node.js migration script

## How to Apply the Fix

### Important: Production Database Only
The database migration should be run against your **Azure production database**, not your local development database. The migration script will connect using the credentials in `backend.env`.

### Step 1: Run the Database Migration

**Option A: Using Node.js Migration Script** (Recommended if you have backend.env configured for Azure)

Navigate to the backend directory and run:

```bash
cd backend
node scripts/fix-budget-manager-role.js
```

**Option B: Using Azure Portal SQL Query Editor**

If the Node.js script fails or you prefer direct access:

1. Go to Azure Portal → Your SQL Database
2. Open "Query editor (preview)"
3. Login with your credentials
4. Copy and paste the contents of `backend/scripts/fix-budget-manager-role.sql`
5. Click "Run"

**Option C: Using SQL Server Management Studio (SSMS)**

1. Connect to your Azure SQL Database using SSMS
2. Open `backend/scripts/fix-budget-manager-role.sql`
3. Execute the script

The migration will:
1. Find all users with "Budget Manager" role
2. Update them to "BudgetManager"
3. Display before/after verification

### Step 2: Rebuild and Redeploy

#### Frontend:
```bash
cd frontend
npm run build
```

#### Backend:
```bash
cd backend
npm run build
```

#### Deploy to Azure:
Deploy the updated files to your Azure App Service.

### Step 3: Clear Browser Cache
Ask affected users to:
1. Log out of the application
2. Clear their browser cache (or use Ctrl+Shift+R / Cmd+Shift+R)
3. Log back in

Alternatively, users can simply refresh the page after the fix is deployed.

## Verification Steps

1. **Check Database**: Run this query to verify all roles are correct:
   ```sql
   SELECT ID, Name, EmailAddress, Role, Active
   FROM dbo.SystemUsers
   WHERE Role != '' AND Active = 1
   ```

2. **Test User Access**:
   - Have a user with BudgetManager role log in
   - They should see the dashboard instead of "Access Pending" page
   - Check they can access appropriate features based on their role

3. **Check Backend Logs**: Look for these log messages when users log in:
   ```
   ✅ Audit log: Role changed for [email] from 'Budget Manager' to 'BudgetManager'
   ```

## Role Permissions Summary

After the fix, roles work as follows:

- **Admin**: Full access to everything including Settings
- **BudgetManager**: 
  - Full access: Scheduled Records, Glidepath, Export
  - View only: Home, Projects, Resources, Positions, Gantt, Payroll, Payments, Reports
  - No access: Settings
- **Editor**: 
  - Full access to all pages except Settings
  - View, Edit, Delete, Export permissions
- **Viewer**: 
  - View only: Home, Gantt
  - No access to other pages

## Prevention

The role names are now consistent across the entire application:
- Backend: `'Admin' | 'BudgetManager' | 'Editor' | 'Viewer' | ''`
- Frontend: `'Admin' | 'BudgetManager' | 'Editor' | 'Viewer'`

When assigning new roles through the UI, the correct format will be used automatically.

## Files Modified

### Backend:
- `backend/src/routes/systemUsers.ts` - Added clearRoleCache call
- `backend/scripts/fix-budget-manager-role.sql` - New migration script
- `backend/scripts/fix-budget-manager-role.js` - New migration script

### Frontend:
- `frontend/src/types/systemUsers.ts` - Fixed role type
- `frontend/src/contexts/PermissionsContext.tsx` - Fixed role check
- `frontend/src/pages/Settings.tsx` - Fixed role options

## Additional Notes

- The super admin email (sinan.mecit@arkgroupdmcc.com) is hardcoded and always has Admin access
- Role changes are now logged in the `dbo.RoleAuditLog` table
- Role cache is automatically cleared when roles are updated, ensuring immediate effect
- The RBAC middleware caches roles for 5 minutes for performance, but this is cleared on updates

## Support

If users still experience access issues after applying this fix:

1. Verify the user exists in `dbo.SystemUsers` table
2. Check that `Active = 1` for the user
3. Verify the `Role` column contains a valid role (no extra spaces or typos)
4. Check browser console for any API errors
5. Check backend logs for authentication/authorization errors
