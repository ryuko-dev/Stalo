/**
 * Business Central API Proxy Routes
 * 
 * Proxies requests to Business Central OData API with server-side OAuth2 authentication
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import sql from 'mssql';
import { getDbConfig } from '../config/database';

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
    const { project, startDate, endDate, versionId } = req.query;

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
    
    // Fetch from Project_Ledger_Entries_Excel
    const response = await bcClient.get('/Project_Ledger_Entries_Excel', {
      params: {
        $filter: filter
      }
    });

    const entries = (response.data as any).value || [];
    
    // Get unique document numbers to fetch document dates and external document numbers
    const documentNos = [...new Set(entries.map((entry: any) => entry.Document_No))];
    
    // Fetch document dates from JobLedgerEntries in batches
    const documentDateMap: { [key: string]: string } = {};
    
    // Fetch external document numbers from General_Ledger_Entries_Excel in batches
    const externalDocumentMap: { [key: string]: string } = {};
    
    if (documentNos.length > 0) {
      try {
        // Build filter for document numbers (OData has URL length limits, so batch if needed)
        const batchSize = 50;
        for (let i = 0; i < documentNos.length; i += batchSize) {
          const batch = documentNos.slice(i, i + batchSize);
          const docFilter = batch.map(docNo => `Document_No eq '${docNo}'`).join(' or ');
          
          const jobLedgerResponse = await bcClient.get('/JobLedgerEntries', {
            params: {
              $filter: docFilter,
              $select: 'Document_No,Document_Date'
            }
          });
          
          const jobLedgerEntries = (jobLedgerResponse.data as any).value || [];
          jobLedgerEntries.forEach((entry: any) => {
            if (!documentDateMap[entry.Document_No]) {
              documentDateMap[entry.Document_No] = entry.Document_Date;
            }
          });
        }
      } catch (docError) {
        console.error('Error fetching document dates from JobLedgerEntries:', docError);
        // Continue without document dates if there's an error
      }
      
      try {
        // Fetch external document numbers from General_Ledger_Entries_Excel
        const batchSize = 50;
        for (let i = 0; i < documentNos.length; i += batchSize) {
          const batch = documentNos.slice(i, i + batchSize);
          const docFilter = batch.map(docNo => `Document_No eq '${docNo}'`).join(' or ');
          
          const generalLedgerResponse = await bcClient.get('/General_Ledger_Entries_Excel', {
            params: {
              $filter: docFilter,
              $select: 'Document_No,External_Document_No'
            }
          });
          
          const generalLedgerEntries = (generalLedgerResponse.data as any).value || [];
          generalLedgerEntries.forEach((entry: any) => {
            if (!externalDocumentMap[entry.Document_No]) {
              externalDocumentMap[entry.Document_No] = entry.External_Document_No;
            }
          });
        }
      } catch (extDocError) {
        console.error('Error fetching external document numbers from General_Ledger_Entries_Excel:', extDocError);
        // Continue without external document numbers if there's an error
      }
    }
    
    // Fetch Job Task Lines for the project to get task descriptions and hierarchy
    const jobTaskMap: { [key: string]: { Job_Task_No: string, Description: string } } = {};
    const jobTaskHierarchy: any[] = [];
    
    try {
      const jobTaskResponse = await bcClient.get('/Job_Task_Lines', {
        params: {
          $filter: `Job_No eq '${project}'`,
          $select: 'Job_No,Job_Task_No,Description,Job_Task_Type'
        }
      });
      
      const jobTasks = (jobTaskResponse.data as any).value || [];
      
      // Build job task map for quick lookup
      jobTasks.forEach((task: any) => {
        const key = `${task.Job_No}|${task.Job_Task_No}`;
        jobTaskMap[key] = {
          Job_Task_No: task.Job_Task_No,
          Description: task.Description || ''
        };
      });
      
      // Build hierarchy structure
      // Task_Type: Total = grouping level, Posting = transaction level
      const totalTasks = jobTasks.filter((t: any) => t.Job_Task_Type === 'Total');
      const postingTasks = jobTasks.filter((t: any) => t.Job_Task_Type === 'Posting');
      
      // Group posting tasks under their parent totals
      postingTasks.forEach((posting: any) => {
        const taskNo = posting.Job_Task_No;
        const parts = taskNo.split('.');
        
        let level1Task = null;
        let level2Task = null;
        
        // Find parent Total tasks
        for (const total of totalTasks) {
          const totalParts = total.Job_Task_No.split('.');
          
          // Check if this posting task is under this total
          if (taskNo.startsWith(total.Job_Task_No + '.') || 
              (parts.length === totalParts.length + 1 && taskNo.startsWith(total.Job_Task_No.split('.')[0]))) {
            
            if (totalParts.length === 1) {
              level1Task = total;
            } else if (totalParts.length === 2) {
              level2Task = total;
            }
          }
        }
        
        // For 2-level hierarchy (e.g., 02 -> 02.01 where 02.01 is Posting)
        if (!level1Task && parts.length === 2) {
          // Find the parent total with just the first part
          level1Task = totalTasks.find((t: any) => t.Job_Task_No === parts[0]);
        }
        
        // For 3-level hierarchy (e.g., 02 -> 02.01 -> 02.01.01)
        if (parts.length === 3) {
          level1Task = totalTasks.find((t: any) => t.Job_Task_No === parts[0]);
          level2Task = totalTasks.find((t: any) => t.Job_Task_No === `${parts[0]}.${parts[1]}`);
        }
        
        jobTaskHierarchy.push({
          Job_Task_No: posting.Job_Task_No,
          Description: posting.Description || '',
          Level1_Job_Task_No: level1Task?.Job_Task_No || '',
          Level1_Description: level1Task?.Description || '',
          Level2_Job_Task_No: level2Task?.Job_Task_No || '',
          Level2_Description: level2Task?.Description || '',
          Has_Middle_Level: !!level2Task
        });
      });
      
      console.log(`✅ Fetched ${jobTasks.length} job task lines for project ${project}`);
      console.log(`✅ Built hierarchy with ${jobTaskHierarchy.length} posting tasks`);
    } catch (jobTaskError) {
      console.error('Error fetching job task lines:', jobTaskError);
      // Continue without job task descriptions if there's an error
    }
    
    // Merge document dates, external document numbers, and job task descriptions into entries
    const enrichedEntries = entries.map((entry: any) => {
      const taskHierarchy = jobTaskHierarchy.find(h => h.Job_Task_No === entry.Donor_Project_Task_No);
      
      return {
        ...entry,
        Document_Date: documentDateMap[entry.Document_No] || null,
        External_Document_No: externalDocumentMap[entry.Document_No] || null,
        Job_Task_Description: taskHierarchy?.Description || '',
        Level1_Job_Task_No: taskHierarchy?.Level1_Job_Task_No || '',
        Level1_Description: taskHierarchy?.Level1_Description || '',
        Level2_Job_Task_No: taskHierarchy?.Level2_Job_Task_No || '',
        Level2_Description: taskHierarchy?.Level2_Description || '',
        Has_Middle_Level: taskHierarchy?.Has_Middle_Level || false
      };
    });
    
    // Fetch budget data from BudgetData table for the project and date range
    // Use provided versionId, or fall back to baseline version (Is_Baseline = 1)
    const budgetMap: { [key: string]: number } = {};
    let usedVersionId: number | null = null;
    
    try {
      const pool = await sql.connect(getDbConfig());
      
      // If versionId is provided, use it directly; otherwise find the baseline version
      if (versionId) {
        usedVersionId = parseInt(versionId as string, 10);
        console.log(`📊 Using provided version ID: ${usedVersionId}`);
      } else {
        // Get the baseline version for this project
        const versionResult = await pool.request()
          .input('jobNo', sql.NVarChar(20), project)
          .query(`
            SELECT Version_ID 
            FROM BudgetVersions 
            WHERE Job_No = @jobNo AND Is_Baseline = 1
          `);
        
        if (versionResult.recordset.length > 0) {
          usedVersionId = versionResult.recordset[0].Version_ID;
          console.log(`📊 Using baseline version ID: ${usedVersionId}`);
        } else {
          console.log(`⚠️ No baseline version found for project ${project}`);
        }
      }
      
      if (usedVersionId !== null) {
        // Build date filter for budget months
        let budgetFilter = 'bd.Job_No = @jobNo AND bd.Version_ID = @versionId';
        if (startDate && endDate) {
          budgetFilter += ' AND bd.Budget_Month >= @startDate AND bd.Budget_Month <= @endDate';
        }
        
        const budgetResult = await pool.request()
          .input('jobNo', sql.NVarChar(20), project)
          .input('versionId', sql.Int, usedVersionId)
          .input('startDate', sql.Date, startDate || null)
          .input('endDate', sql.Date, endDate || null)
          .query(`
            SELECT bd.Job_Task_No, SUM(bd.Budget_Amount) as Total_Budget
            FROM BudgetData bd
            WHERE ${budgetFilter}
            GROUP BY bd.Job_Task_No
          `);
        
        // Create a map of Job_Task_No to Total_Budget
        budgetResult.recordset.forEach((row: any) => {
          budgetMap[row.Job_Task_No] = row.Total_Budget;
        });
        
        console.log(`✅ Fetched budget data for ${budgetResult.recordset.length} tasks from version ID: ${usedVersionId}`);
      }
    } catch (budgetError) {
      console.error('Error fetching budget data:', budgetError);
      // Continue without budget data if there's an error
    }
    
    // Add budget data to entries
    const finalEntries = enrichedEntries.map((entry: any) => ({
      ...entry,
      Budget_Amount: budgetMap[entry.Donor_Project_Task_No] || 0
    }));
    
    // Add budget amounts to hierarchy
    const hierarchyWithBudget = jobTaskHierarchy.map((task: any) => ({
      ...task,
      Budget_Amount: budgetMap[task.Job_Task_No] || 0
    }));
    
    res.json({ 
      entries: finalEntries, 
      count: finalEntries.length,
      jobTaskHierarchy: hierarchyWithBudget
    });
  } catch (error: any) {
    console.error('Error fetching ledger entries from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch ledger entries',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/project-cards
 * Fetch project cards
 */
router.get('/project-cards', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    
    const response = await bcClient.get('/Project_Card_Excel');
    const projectCards = (response.data as any).value || [];
    
    res.json({ projectCards, count: projectCards.length });
  } catch (error: any) {
    console.error('Error fetching project cards from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch project cards',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/job-task-lines
 * Fetch job task lines for a specific project
 * Query params: jobNo
 */
router.get('/job-task-lines', async (req: Request, res: Response) => {
  try {
    const { jobNo } = req.query;

    if (!jobNo) {
      return res.status(400).json({ error: 'jobNo parameter is required' });
    }

    const bcClient = await createBCClient();
    
    const response = await bcClient.get('/Job_Task_Lines', {
      params: {
        $filter: `Job_No eq '${jobNo}'`
      }
    });

    const taskLines = (response.data as any).value || [];
    
    res.json({ taskLines, count: taskLines.length });
  } catch (error: any) {
    console.error('Error fetching job task lines from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch job task lines',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/personnel-expenses
 * Fetch grouped personnel expenses
 * Query params:
 *   - showAll: if true, return all records (default: filter by unpaid, blank Payment_Reference, and exclude Draft status)
 */
router.get('/personnel-expenses', async (req: Request, res: Response) => {
  try {
    const showAll = req.query.showAll === 'true';
    const bcClient = await createBCClient();
    
    // Don't use $select or $filter - just get all data
    const response = await bcClient.get('/Grouped_Personnel_Expense_Excel');

    const allExpenses = (response.data as any).value || [];
    
    let expenses;
    if (showAll) {
      // Return all records
      expenses = allExpenses;
    } else {
      // Filter unpaid, blank Payment_Reference, and exclude Draft status
      expenses = allExpenses.filter((exp: any) => 
        exp.Paid === false && 
        (!exp.Payment_Reference || exp.Payment_Reference.trim() === '') &&
        exp.Status !== 'Draft'
      );
    }
    
    res.json({ expenses, count: expenses.length });
  } catch (error: any) {
    console.error('Error fetching personnel expenses from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch personnel expenses',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/prepayments
 * Fetch prepayment information with payment date
 * Query params: showAll=true to show all prepayments (default: only with payment date)
 */
router.get('/prepayments', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    const showAll = req.query.showAll === 'true';
    
    // Get all data without filters - let OData return everything
    const response = await bcClient.get('/Prepayment_Information_Excel');

    const allPrepayments = (response.data as any).value || [];
    
    // Filter based on showAll parameter
    let prepayments;
    if (showAll) {
      // Show all prepayments
      prepayments = allPrepayments;
    } else {
      // Show only prepayments with payment date
      prepayments = allPrepayments.filter((prep: any) => {
        return prep.Payment_Date && 
               prep.Payment_Date.trim() !== '' && 
               !prep.Payment_Date.startsWith('0001-01-01') &&
               !prep.Payment_Date.startsWith('1900-01-01');
      });
    }
    
    // Ensure Payment_Method is included in the response
    const enrichedPrepayments = prepayments.map((prep: any) => ({
      ...prep,
      Payment_Method: prep.Payment_Method || ''
    }));
    
    res.json({ prepayments: enrichedPrepayments, count: enrichedPrepayments.length });
  } catch (error: any) {
    console.error('Error fetching prepayments from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch prepayments',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * GET /api/bc/vendors
 * Fetch vendor list from workflowVendors
 */
router.get('/vendors', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    
    const response = await bcClient.get('/workflowVendors');
    const vendors = (response.data as any).value || [];
    
    res.json({ vendors, count: vendors.length });
  } catch (error: any) {
    console.error('Error fetching vendors from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch vendors',
      details: error.response?.data || error.message 
    });
  }
});

router.get('/purchase-invoices', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    
    // Fetch posted purchase invoices
    const invoiceResponse = await bcClient.get('/Posted_Purchase_Invoice_Excel');
    const invoices = (invoiceResponse.data as any).value || [];
    
    // Try to fetch vendor ledger entries, but continue if it fails
    let ledgerMap = new Map();
    try {
      const ledgerResponse = await bcClient.get('/Vendor_Ledger_Entries_Excel', {
        params: {
          $filter: "Document_Type eq 'Invoice'"
        }
      });
      const ledgerEntries = (ledgerResponse.data as any).value || [];
      
      // Create a map of Document_No -> ledger entry for quick lookup
      ledgerEntries.forEach((entry: any) => {
        if (entry.Document_No && !ledgerMap.has(entry.Document_No)) {
          ledgerMap.set(entry.Document_No, {
            Open: entry.Open,
            Original_Amount: entry.Original_Amount || 0
          });
        }
      });
    } catch (ledgerError: any) {
      console.warn('Could not fetch vendor ledger entries, using invoice data only:', ledgerError.message);
    }
    
    // Merge the data
    const enrichedInvoices = invoices.map((invoice: any) => {
      const ledgerData = ledgerMap.get(invoice.No);
      
      if (ledgerData) {
        return {
          ...invoice,
          Closed: !ledgerData.Open, // Open = false means Closed = true
          Amount: Math.abs(ledgerData.Original_Amount), // Use Original_Amount from ledger
          Payment_Method_Code: invoice.Payment_Method_Code || '' // Include payment method code
        };
      } else {
        // Fallback to invoice data if ledger entry not found
        return {
          ...invoice,
          Closed: invoice.Closed || false, // Use existing Closed field or default to false
          Amount: invoice.Amount || 0, // Use existing Amount
          Payment_Method_Code: invoice.Payment_Method_Code || '' // Include payment method code
        };
      }
    });
    
    res.json({ invoices: enrichedInvoices, count: enrichedInvoices.length });
  } catch (error: any) {
    console.error('Error fetching purchase invoices from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch purchase invoices',
      details: error.response?.data || error.message 
    });
  }
});

router.get('/salary-payments', async (req: Request, res: Response) => {
  try {
    const bcClient = await createBCClient();
    
    const response = await bcClient.get('/SalariesList');
    const salaries = (response.data as any).value || [];
    
    res.json({ salaries, count: salaries.length });
  } catch (error: any) {
    console.error('Error fetching salary payments from BC:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch salary payments',
      details: error.response?.data || error.message 
    });
  }
});

export default router;
