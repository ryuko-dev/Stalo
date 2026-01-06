/**
 * SharePoint Service - Folder Management
 * 
 * Handles creation and access to SharePoint folders for scheduled records
 */

import { getAccessToken } from './authService';

// SharePoint configuration
// You'll need to configure these based on your SharePoint site
const SHAREPOINT_SITE_ID = import.meta.env.VITE_SHAREPOINT_SITE_ID || '';
const SHAREPOINT_DRIVE_ID = import.meta.env.VITE_SHAREPOINT_DRIVE_ID || '';
const SHAREPOINT_ROOT_FOLDER = import.meta.env.VITE_SHAREPOINT_ROOT_FOLDER || 'Scheduled Records';

interface FolderResult {
  success: boolean;
  folderUrl?: string;
  error?: string;
  created?: boolean;
}

/**
 * Create or get existing folder in SharePoint
 * Folder name format: {ID}_{Type} or custom folderName
 * @param recordId - Unique identifier (can be version ID or record ID)
 * @param folderName - Custom folder name or record type
 * @param customRootFolder - Optional custom root folder (defaults to SHAREPOINT_ROOT_FOLDER)
 */
export async function createOrOpenFolder(
  recordId: number, 
  folderName: string,
  customRootFolder?: string
): Promise<FolderResult> {
  try {
    // Get access token with SharePoint permissions
    const token = await getAccessToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated. Please login first.' };
    }

    if (!SHAREPOINT_SITE_ID || !SHAREPOINT_DRIVE_ID) {
      return { 
        success: false, 
        error: 'SharePoint configuration missing. Please configure VITE_SHAREPOINT_SITE_ID and VITE_SHAREPOINT_DRIVE_ID in .env.local' 
      };
    }

    // Use custom root folder if provided, otherwise use default
    const rootFolder = customRootFolder || SHAREPOINT_ROOT_FOLDER;

    // Format folder name: use the provided folderName directly (it might already include ID)
    const finalFolderName = folderName.includes('_') ? folderName : `${recordId}_${folderName}`;
    const folderPath = rootFolder ? `${rootFolder}/${finalFolderName}` : finalFolderName;

    return await createOrOpenFolderInternal(token, folderPath, folderName, SHAREPOINT_ROOT_FOLDER);
  } catch (error: any) {
    console.error('SharePoint folder error:', error);
    return {
      success: false,
      error: error.message || 'Failed to access SharePoint',
    };
  }
}

/**
 * Create or open budget version folder in SharePoint
 * Folder name format: {ProjectName}_{VersionName}
 */
export async function createOrOpenBudgetVersionFolder(projectName: string, versionName: string): Promise<FolderResult> {
  try {
    // Get access token with SharePoint permissions
    const token = await getAccessToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated. Please login first.' };
    }

    if (!SHAREPOINT_SITE_ID || !SHAREPOINT_DRIVE_ID) {
      return { 
        success: false, 
        error: 'SharePoint configuration missing. Please configure VITE_SHAREPOINT_SITE_ID and VITE_SHAREPOINT_DRIVE_ID in .env.local' 
      };
    }

    // Format folder name: ProjectName_VersionName (e.g., "001-ZENO_2025 Budget")
    const folderName = `${projectName}_${versionName}`;
    const rootFolder = 'Project_Budget_Version';
    const folderPath = `${rootFolder}/${folderName}`;

    return await createOrOpenFolderInternal(token, folderPath, folderName, rootFolder);
  } catch (error: any) {
    console.error('SharePoint budget version folder error:', error);
    return {
      success: false,
      error: error.message || 'Failed to access SharePoint',
    };
  }
}

/**
 * Create or open client invoice folder in SharePoint
 * Creates folder structure: Client Invoices/{InvoiceNo}
 */
export async function createOrOpenClientInvoiceFolder(invoiceNo: string): Promise<FolderResult> {
  try {
    // Get access token with SharePoint permissions
    const token = await getAccessToken();
    
    if (!token) {
      return { success: false, error: 'Not authenticated. Please login first.' };
    }

    if (!SHAREPOINT_SITE_ID || !SHAREPOINT_DRIVE_ID) {
      return { 
        success: false, 
        error: 'SharePoint configuration missing. Please configure VITE_SHAREPOINT_SITE_ID and VITE_SHAREPOINT_DRIVE_ID in .env.local' 
      };
    }

    // Folder structure: Client Invoices/{InvoiceNo}
    const rootFolder = 'Client Invoices';
    const folderPath = `${rootFolder}/${invoiceNo}`;

    return await createOrOpenFolderInternal(token, folderPath, invoiceNo, rootFolder);
  } catch (error: any) {
    console.error('SharePoint client invoice folder error:', error);
    return {
      success: false,
      error: error.message || 'Failed to access SharePoint',
    };
  }
}

/**
 * Internal helper function to create or open a folder
 */
async function createOrOpenFolderInternal(
  token: string,
  folderPath: string,
  folderName: string,
  rootFolder?: string
): Promise<FolderResult> {
  try {
    const checkUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/root:/${encodeURIComponent(folderPath)}`;
    
    let folderExists = false;
    let folderWebUrl = '';

    try {
      const checkResponse = await fetch(checkUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (checkResponse.ok) {
        const folderData = await checkResponse.json();
        folderExists = true;
        folderWebUrl = folderData.webUrl;
        console.log(`✅ Folder exists: ${folderName}`);
      }
    } catch (error) {
      // Folder doesn't exist, will create it
      console.log(`📁 Folder doesn't exist, will create: ${folderName}`);
    }

    // Create folder if it doesn't exist
    if (!folderExists) {
      // First ensure root folder exists
      if (rootFolder) {
        try {
          const rootUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/root/children`;
          await fetch(rootUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: rootFolder,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'fail', // Don't create if exists
            }),
          });
        } catch (error) {
          // Root folder might already exist, continue
        }
      }

      // Create the record folder
      const parentPath = rootFolder ? `root:/${encodeURIComponent(rootFolder)}:` : 'root';
      const createUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drives/${SHAREPOINT_DRIVE_ID}/${parentPath}/children`;
      
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename', // Auto-rename if somehow exists
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error?.message || 'Failed to create folder');
      }

      const newFolder = await createResponse.json();
      folderWebUrl = newFolder.webUrl;
      console.log(`✅ Folder created: ${folderName}`);
      
      return {
        success: true,
        folderUrl: folderWebUrl,
        created: true,
      };
    }

    return {
      success: true,
      folderUrl: folderWebUrl,
      created: false,
    };

  } catch (error: any) {
    console.error('SharePoint folder error:', error);
    return {
      success: false,
      error: error.message || 'Failed to access SharePoint',
    };
  }
}

/**
 * Get SharePoint site and drive IDs (helper for initial setup)
 * This can be used to discover your SharePoint site configuration
 */
export async function getSharePointInfo(siteName: string): Promise<any> {
  try {
    const token = await getAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Search for site
    const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(siteName)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const searchData = await searchResponse.json();
    
    if (searchData.value && searchData.value.length > 0) {
      const site = searchData.value[0];
      
      // Get drives for the site
      const drivesUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/drives`;
      const drivesResponse = await fetch(drivesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const drivesData = await drivesResponse.json();
      
      return {
        siteId: site.id,
        siteName: site.displayName,
        siteUrl: site.webUrl,
        drives: drivesData.value.map((drive: any) => ({
          id: drive.id,
          name: drive.name,
          type: drive.driveType,
        })),
      };
    }

    throw new Error('Site not found');
  } catch (error: any) {
    console.error('SharePoint info error:', error);
    throw error;
  }
}

export default {
  createOrOpenFolder,
  createOrOpenBudgetVersionFolder,
  createOrOpenClientInvoiceFolder,
  getSharePointInfo,
};
