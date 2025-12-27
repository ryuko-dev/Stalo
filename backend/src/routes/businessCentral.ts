/**
 * Business Central API Proxy Routes
 * 
 * Proxies requests to Business Central OData API with server-side OAuth2 authentication
 */

import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// Business Central configuration from environment variables
const BC_BASE_URL = process.env.BC_BASE_URL || 
  'https://api.businesscentral.dynamics.com/v2.0/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/ODataV4/Company(\'ARK%20Group%20Live\')';
const BC_CLIENT_ID = process.env.BC_CLIENT_ID || '';
const BC_CLIENT_SECRET = process.env.BC_CLIENT_SECRET || '';
const BC_TENANT_ID = process.env.BC_TENANT_ID || '9f4e2976-b07e-4f8f-9c78-055f6c855a11';

// Token cache
let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth2 access token for Business Central
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${BC_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: BC_CLIENT_ID,
      client_secret: BC_CLIENT_SECRET,
      scope: 'https://api.businesscentral.dynamics.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    accessToken = (response.data as any).access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    tokenExpiry = Date.now() + ((response.data as any).expires_in - 300) * 1000;

    console.log('✅ BC access token acquired');
    return accessToken as string;
  } catch (error: any) {
    console.error('❌ Failed to get BC access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Business Central');
  }
}

/**
 * Create axios instance with OAuth2 authentication
 */
async function createBCClient() {
  const token = await getAccessToken();
  
  return axios.create({
    baseURL: BC_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    timeout: 30000,
  });
}

/**
 * GET /api/bc/projects
 * Fetch project list from Job_List
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    const response = await bcClient.get('/Job_List', {
      params: {
        $select: 'No,Description,Bill_to_Customer_No,Status,Person_Responsible,Search_Description,Project_Manager'
      }
    });

    const projects = (response.data as any).value || [];
    const projectNumbers = projects.map((job: any) => job.No).filter((no: string) => no && no.trim());
    
    res.json({ projects: projectNumbers });
  } catch (error: any) {
    console.error('Error fetching projects from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch projects',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/ledger-entries
 * Fetch project ledger entries with filters
 * Query params: project, startDate, endDate
 */
router.get('/ledger-entries', async (req: Request, res: Response) => {
  try {
    const { project, startDate, endDate } = req.query;

    if (!project) {
      return res.status(400).json({ error: 'Project parameter is required' });
    }

    // Build OData filter
    let filter = `Donor_Project_No eq '${project}'`;
    
    if (startDate) {
      filter += ` and Posting_Date ge ${startDate}`;
    }
    if (endDate) {
      filter += ` and Posting_Date le ${endDate}`;
    }

    const bcClient = await createBCClient();
    const response = await bcClient.get('/Project_Ledger_Entries_Excel', {
      params: {
        $filter: filter
      }
    });

    const entries = (response.data as any).value || [];
    
    res.json({ entries, count: entries.length });
  } catch (error: any) {
    console.error('Error fetching ledger entries from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch ledger entries',
      details: error.response?.data || error.message 
    });
  }
});

export default router;
