# SharePoint Integration Setup Guide

## Overview
The Scheduled Records section now includes SharePoint folder management. When viewing a scheduled record, users can click the folder icon to create or open a SharePoint folder named `{ID}_{Type}` (e.g., "123_Prepaid Expense").

## Prerequisites
- Azure AD App Registration with SharePoint permissions
- SharePoint site with a document library

## Step 1: Configure Environment Variables

Add the following to your `frontend/.env.local` file:

```env
# SharePoint Configuration
VITE_SHAREPOINT_SITE_ID=your-site-id-here
VITE_SHAREPOINT_DRIVE_ID=your-drive-id-here
VITE_SHAREPOINT_ROOT_FOLDER=Scheduled Records
```

## Step 2: Get Your SharePoint Site and Drive IDs

### Method 1: Using Microsoft Graph Explorer
1. Go to https://developer.microsoft.com/graph/graph-explorer
2. Sign in with your Microsoft account

#### For Subsites (like /Corporate/FIN):
3. If your SharePoint URL is `https://arkgroupdmcc.sharepoint.com/Corporate/FIN`, run:
   ```
   GET https://graph.microsoft.com/v1.0/sites/arkgroupdmcc.sharepoint.com:/Corporate/FIN:
   ```
   Note: Don't include `/SitePages/Home.aspx` or any page paths, just the site path.

#### For Root Sites:
3. Run this query to search by name (use just the site name, not full URL):
   ```
   GET https://graph.microsoft.com/v1.0/sites?search=FIN
   ```

4. Copy the `id` field from the response (this is your SITE_ID)
5. Get the drives for that site:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{SITE_ID}/drives
   ```
6. Find your Documents library and copy its `id` (this is your DRIVE_ID)

#### Example for your site:
For `https://arkgroupdmcc.sharepoint.com/Corporate/FIN`:
```
GET https://graph.microsoft.com/v1.0/sites/arkgroupdmcc.sharepoint.com:/Corporate/FIN:
```
Then get drives:
```
GET https://graph.microsoft.com/v1.0/sites/{SITE_ID_FROM_ABOVE}/drives
```

### Method 2: Using the Helper Function (After Setup)
1. Temporarily add this to your Scheduled Records page:
   ```typescript
   // In console
   sharepointService.getSharePointInfo('YourSiteName').then(console.log)
   ```
2. The function will return your site and drive information

### Method 3: From SharePoint URL
Your SharePoint site URL looks like:
```
https://{tenant}.sharepoint.com/sites/{sitename}
```

The site ID format is: `{tenant}.sharepoint.com,{guid},{guid}`

## Step 3: Azure AD App Registration Permissions

Your Azure AD app already has these permissions granted (as confirmed):
- ✅ `Files.ReadWrite.All` - Read and write files in all site collections
- ✅ `Sites.ReadWrite.All` - Read and write items in all site collections

These scopes have been added to the authentication configuration.

## Step 4: Verify Folder Structure

The system will create folders in this structure:
```
SharePoint Site
└── Documents
    └── Scheduled Records (root folder, auto-created)
        ├── 1_Prepaid Expense
        ├── 2_Fixed Asset
        ├── 3_Prepaid Expense
        └── ...
```

## Step 5: Test the Integration

1. Navigate to the Scheduled Records page
2. Find any record in the table
3. Click the **folder icon** (purple/secondary color) next to the View icon
4. If the folder doesn't exist, it will be created and opened
5. If the folder exists, it will simply be opened in a new tab

## Troubleshooting

### Error: "SharePoint configuration missing"
- Ensure `VITE_SHAREPOINT_SITE_ID` and `VITE_SHAREPOINT_DRIVE_ID` are set in `.env.local`
- Restart the frontend development server after adding environment variables

### Error: "Not authenticated"
- Make sure you're logged in to Microsoft 365
- Try logging out and logging back in to refresh tokens

### Error: "Access denied" or 403
- Verify the Azure AD app has the correct permissions
- Ensure admin consent has been granted for the permissions
- Check that your user account has access to the SharePoint site

### Folder not opening
- Check browser pop-up blocker settings
- Verify the SharePoint site URL is accessible
- Check browser console for detailed error messages

## Usage Notes

- **Folder Naming**: Folders are automatically named as `{ScheduledID}_{Type}`
- **Existing Folders**: If a folder already exists, it will be opened without creating a duplicate
- **Root Folder**: The `Scheduled Records` root folder is created automatically if it doesn't exist
- **Permissions**: Users will have the same permissions in these folders as they have in the SharePoint site

## Example Configuration

```env
# Your actual configuration for FIN site
VITE_SHAREPOINT_SITE_ID=arkgroupdmcc.sharepoint.com,a0fcec48-543a-44d0-8f5d-08e813e3212f,f0a32ebf-b746-4634-bb78-4a63f402d4fe
VITE_SHAREPOINT_DRIVE_ID=b!SOz8oDpU0ESPXQjoE-MhL78uo_BGtzRGu3hKY_QC1P4FRbUL6YvvTZYUUL0WDLRP
VITE_SHAREPOINT_ROOT_FOLDER=Scheduled Records
```

Copy this configuration to your `frontend/.env.local` file and restart the frontend dev server.

## Features

✅ Create folders automatically when clicking the folder icon
✅ Open existing folders if they already exist
✅ Folder names follow the format: `{ID}_{Type}`
✅ Root folder organization under "Scheduled Records"
✅ Opens folders in a new browser tab
✅ Handles errors gracefully with user-friendly messages

## Next Steps

After configuration, users can:
1. Click the folder icon on any scheduled record
2. Upload documents related to that record
3. Share the folder with team members
4. Organize files by record type automatically

The folder structure keeps all scheduled record documentation organized and easily accessible through both the application and SharePoint directly.
