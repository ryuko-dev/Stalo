"use strict";
/**
 * Business Central API Proxy Routes
 *
 * Proxies requests to Business Central OData API with server-side OAuth2 authentication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const mssql_1 = __importDefault(require("mssql"));
const database_1 = require("../config/database");
const router = express_1.default.Router();
// Business Central configuration from environment variables
const BC_BASE_URL = process.env.BC_BASE_URL ||
    'https://api.businesscentral.dynamics.com/v2.0/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/ODataV4/Company(\'ARK%20Group%20Live\')';
const BC_CLIENT_ID = process.env.BC_CLIENT_ID || '';
const BC_CLIENT_SECRET = process.env.BC_CLIENT_SECRET || '';
const BC_TENANT_ID = process.env.BC_TENANT_ID || '9f4e2976-b07e-4f8f-9c78-055f6c855a11';
// Token cache
let accessToken = null;
let tokenExpiry = 0;
/**
 * Get OAuth2 access token for Business Central
 */
async function getAccessToken() {
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
        const response = await axios_1.default.post(tokenUrl, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        accessToken = response.data.access_token;
        // Set expiry to 5 minutes before actual expiry for safety
        tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
        console.log('✅ BC access token acquired');
        return accessToken;
    }
    catch (error) {
        console.error('❌ Failed to get BC access token:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Business Central');
    }
}
/**
 * Create axios instance with OAuth2 authentication
 */
async function createBCClient() {
    const token = await getAccessToken();
    return axios_1.default.create({
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
router.get('/projects', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/Job_List', {
            params: {
                $select: 'No,Description,Bill_to_Customer_No,Status,Person_Responsible,Search_Description,Project_Manager'
            }
        });
        const projects = response.data.value || [];
        const projectNumbers = projects.map((job) => job.No).filter((no) => no && no.trim());
        res.json({ projects: projectNumbers });
    }
    catch (error) {
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
router.get('/ledger-entries', async (req, res) => {
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
        const entries = response.data.value || [];
        // Get unique entry numbers to fetch document dates and external document numbers
        // from custom API: datasets/ark%252Ffinance%252Fv1.0/tables/jobLedgerEntries
        const entryNos = [...new Set(entries.map((entry) => entry.Entry_No))];
        // Fetch document dates and external document numbers from custom API
        const documentDateMap = {};
        const externalDocumentMap = {};
        if (entryNos.length > 0) {
            try {
                console.log(`🔍 Fetching data for ${entryNos.length} entry numbers from custom API. Sample Entry_Nos:`, entryNos.slice(0, 5));
                // Build filter for entry numbers (OData has URL length limits, so batch if needed)
                const batchSize = 50;
                for (let i = 0; i < entryNos.length; i += batchSize) {
                    const batch = entryNos.slice(i, i + batchSize);
                    // jlentries uses camelCase field names
                    const entryFilter = batch.map(entryNo => `entryNo eq ${entryNo}`).join(' or ');
                    console.log(`🔍 Batch ${Math.floor(i / batchSize) + 1}: Fetching ${batch.length} entries`);
                    const apiPath = '/jlentries';
                    console.log(`🌐 Making request to: ${BC_BASE_URL}${apiPath}`);
                    // Use jlentries endpoint - uses camelCase: entryNo, documentDate, externalDocumentNo
                    const jobLedgerResponse = await bcClient.get(apiPath, {
                        params: {
                            $filter: entryFilter,
                            $select: 'entryNo,documentDate,externalDocumentNo'
                        }
                    });
                    const jobLedgerEntries = jobLedgerResponse.data.value || [];
                    console.log(`✅ Received ${jobLedgerEntries.length} entries from jlentries API. Sample:`, jobLedgerEntries.slice(0, 2));
                    jobLedgerEntries.forEach((entry) => {
                        // jlentries returns camelCase: entryNo, documentDate, externalDocumentNo
                        if (!documentDateMap[entry.entryNo]) {
                            documentDateMap[entry.entryNo] = entry.documentDate;
                        }
                        if (!externalDocumentMap[entry.entryNo] && entry.externalDocumentNo) {
                            externalDocumentMap[entry.entryNo] = entry.externalDocumentNo;
                        }
                    });
                }
                console.log(`✅ Fetched document dates and external doc numbers for ${Object.keys(documentDateMap).length} entries from jlentries API`);
                console.log(`📊 Sample mappings - documentDateMap:`, Object.entries(documentDateMap).slice(0, 3));
                console.log(`📊 Sample mappings - externalDocumentMap:`, Object.entries(externalDocumentMap).slice(0, 3));
            }
            catch (docError) {
                console.error('Error fetching from jlentries API:', docError.response?.data || docError.message);
                // Continue without document dates/external docs if there's an error
            }
        }
        // Fetch Job Task Lines for the project to get task descriptions and hierarchy
        const jobTaskMap = {};
        const jobTaskHierarchy = [];
        try {
            const jobTaskResponse = await bcClient.get('/Job_Task_Lines', {
                params: {
                    $filter: `Job_No eq '${project}'`,
                    $select: 'Job_No,Job_Task_No,Description,Job_Task_Type'
                }
            });
            const jobTasks = jobTaskResponse.data.value || [];
            // Build job task map for quick lookup
            jobTasks.forEach((task) => {
                const key = `${task.Job_No}|${task.Job_Task_No}`;
                jobTaskMap[key] = {
                    Job_Task_No: task.Job_Task_No,
                    Description: task.Description || ''
                };
            });
            // Build hierarchy structure
            // Task_Type: Total = grouping level, Posting = transaction level
            const totalTasks = jobTasks.filter((t) => t.Job_Task_Type === 'Total');
            const postingTasks = jobTasks.filter((t) => t.Job_Task_Type === 'Posting');
            // Group posting tasks under their parent totals
            postingTasks.forEach((posting) => {
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
                        }
                        else if (totalParts.length === 2) {
                            level2Task = total;
                        }
                    }
                }
                // For 2-level hierarchy (e.g., 02 -> 02.01 where 02.01 is Posting)
                if (!level1Task && parts.length === 2) {
                    // Find the parent total with just the first part
                    level1Task = totalTasks.find((t) => t.Job_Task_No === parts[0]);
                }
                // For 3-level hierarchy (e.g., 02 -> 02.01 -> 02.01.01)
                if (parts.length === 3) {
                    level1Task = totalTasks.find((t) => t.Job_Task_No === parts[0]);
                    level2Task = totalTasks.find((t) => t.Job_Task_No === `${parts[0]}.${parts[1]}`);
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
        }
        catch (jobTaskError) {
            console.error('Error fetching job task lines:', jobTaskError);
            // Continue without job task descriptions if there's an error
        }
        // Merge document dates, external document numbers, and job task descriptions into entries
        const enrichedEntries = entries.map((entry) => {
            const taskHierarchy = jobTaskHierarchy.find(h => h.Job_Task_No === entry.Donor_Project_Task_No);
            const docDate = documentDateMap[entry.Entry_No];
            const extDocNo = externalDocumentMap[entry.Entry_No];
            return {
                ...entry,
                Document_Date: docDate || null,
                External_Document_No: extDocNo || null, // Now using Entry_No from custom API
                Job_Task_Description: taskHierarchy?.Description || '',
                Level1_Job_Task_No: taskHierarchy?.Level1_Job_Task_No || '',
                Level1_Description: taskHierarchy?.Level1_Description || '',
                Level2_Job_Task_No: taskHierarchy?.Level2_Job_Task_No || '',
                Level2_Description: taskHierarchy?.Level2_Description || '',
                Has_Middle_Level: taskHierarchy?.Has_Middle_Level || false
            };
        });
        // Log sample enriched entry to debug mapping
        if (enrichedEntries.length > 0) {
            console.log(`📊 Sample enriched entry:`, {
                Entry_No: enrichedEntries[0].Entry_No,
                Document_Date: enrichedEntries[0].Document_Date,
                External_Document_No: enrichedEntries[0].External_Document_No
            });
        }
        console.log(`✅ Enriched ${enrichedEntries.length} entries with custom API data`);
        // Fetch budget data from BudgetData table for the project and date range
        // Use provided versionId, or fall back to baseline version (Is_Baseline = 1)
        const budgetMap = {};
        let usedVersionId = null;
        try {
            const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
            // If versionId is provided, use it directly; otherwise find the baseline version
            if (versionId) {
                usedVersionId = parseInt(versionId, 10);
                console.log(`📊 Using provided version ID: ${usedVersionId}`);
            }
            else {
                // Get the baseline version for this project
                const versionResult = await pool.request()
                    .input('jobNo', mssql_1.default.NVarChar(20), project)
                    .query(`
            SELECT Version_ID 
            FROM BudgetVersions 
            WHERE Job_No = @jobNo AND Is_Baseline = 1
          `);
                if (versionResult.recordset.length > 0) {
                    usedVersionId = versionResult.recordset[0].Version_ID;
                    console.log(`📊 Using baseline version ID: ${usedVersionId}`);
                }
                else {
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
                    .input('jobNo', mssql_1.default.NVarChar(20), project)
                    .input('versionId', mssql_1.default.Int, usedVersionId)
                    .input('startDate', mssql_1.default.Date, startDate || null)
                    .input('endDate', mssql_1.default.Date, endDate || null)
                    .query(`
            SELECT bd.Job_Task_No, SUM(bd.Budget_Amount) as Total_Budget
            FROM BudgetData bd
            WHERE ${budgetFilter}
            GROUP BY bd.Job_Task_No
          `);
                // Create a map of Job_Task_No to Total_Budget
                budgetResult.recordset.forEach((row) => {
                    budgetMap[row.Job_Task_No] = row.Total_Budget;
                });
                console.log(`✅ Fetched budget data for ${budgetResult.recordset.length} tasks from version ID: ${usedVersionId}`);
            }
        }
        catch (budgetError) {
            console.error('Error fetching budget data:', budgetError);
            // Continue without budget data if there's an error
        }
        // Add budget data to entries
        const finalEntries = enrichedEntries.map((entry) => ({
            ...entry,
            Budget_Amount: budgetMap[entry.Donor_Project_Task_No] || 0
        }));
        // Add budget amounts to hierarchy
        const hierarchyWithBudget = jobTaskHierarchy.map((task) => ({
            ...task,
            Budget_Amount: budgetMap[task.Job_Task_No] || 0
        }));
        res.json({
            entries: finalEntries,
            count: finalEntries.length,
            jobTaskHierarchy: hierarchyWithBudget
        });
    }
    catch (error) {
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
router.get('/project-cards', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/Project_Card_Excel');
        const projectCards = response.data.value || [];
        res.json({ projectCards, count: projectCards.length });
    }
    catch (error) {
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
router.get('/job-task-lines', async (req, res) => {
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
        const taskLines = response.data.value || [];
        res.json({ taskLines, count: taskLines.length });
    }
    catch (error) {
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
router.get('/personnel-expenses', async (req, res) => {
    try {
        const showAll = req.query.showAll === 'true';
        const bcClient = await createBCClient();
        // Don't use $select or $filter - just get all data
        const response = await bcClient.get('/Grouped_Personnel_Expense_Excel');
        const allExpenses = response.data.value || [];
        let expenses;
        if (showAll) {
            // Return all records
            expenses = allExpenses;
        }
        else {
            // Filter unpaid, blank Payment_Reference, and exclude Draft status
            expenses = allExpenses.filter((exp) => exp.Paid === false &&
                (!exp.Payment_Reference || exp.Payment_Reference.trim() === '') &&
                exp.Status !== 'Draft');
        }
        res.json({ expenses, count: expenses.length });
    }
    catch (error) {
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
router.get('/prepayments', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const showAll = req.query.showAll === 'true';
        // Get all data without filters - let OData return everything
        const response = await bcClient.get('/Prepayment_Information_Excel');
        const allPrepayments = response.data.value || [];
        // Filter based on showAll parameter
        let prepayments;
        if (showAll) {
            // Show all prepayments
            prepayments = allPrepayments;
        }
        else {
            // Show only prepayments with payment date
            prepayments = allPrepayments.filter((prep) => {
                return prep.Payment_Date &&
                    prep.Payment_Date.trim() !== '' &&
                    !prep.Payment_Date.startsWith('0001-01-01') &&
                    !prep.Payment_Date.startsWith('1900-01-01');
            });
        }
        // Ensure Payment_Method is included in the response
        const enrichedPrepayments = prepayments.map((prep) => ({
            ...prep,
            Payment_Method: prep.Payment_Method || ''
        }));
        res.json({ prepayments: enrichedPrepayments, count: enrichedPrepayments.length });
    }
    catch (error) {
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
router.get('/vendors', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/workflowVendors');
        const vendors = response.data.value || [];
        res.json({ vendors, count: vendors.length });
    }
    catch (error) {
        console.error('Error fetching vendors from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch vendors',
            details: error.response?.data || error.message
        });
    }
});
router.get('/purchase-invoices', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        // Fetch posted purchase invoices
        const invoiceResponse = await bcClient.get('/Posted_Purchase_Invoice_Excel');
        const invoices = invoiceResponse.data.value || [];
        // Try to fetch vendor ledger entries, but continue if it fails
        let ledgerMap = new Map();
        try {
            const ledgerResponse = await bcClient.get('/Vendor_Ledger_Entries_Excel', {
                params: {
                    $filter: "Document_Type eq 'Invoice'"
                }
            });
            const ledgerEntries = ledgerResponse.data.value || [];
            // Create a map of Document_No -> ledger entry for quick lookup
            ledgerEntries.forEach((entry) => {
                if (entry.Document_No && !ledgerMap.has(entry.Document_No)) {
                    ledgerMap.set(entry.Document_No, {
                        Open: entry.Open,
                        Original_Amount: entry.Original_Amount || 0,
                        External_Document_No: entry.External_Document_No || ''
                    });
                }
            });
        }
        catch (ledgerError) {
            console.warn('Could not fetch vendor ledger entries, using invoice data only:', ledgerError.message);
        }
        // Merge the data
        const enrichedInvoices = invoices.map((invoice) => {
            const ledgerData = ledgerMap.get(invoice.No);
            if (ledgerData) {
                return {
                    ...invoice,
                    Closed: !ledgerData.Open, // Open = false means Closed = true
                    Amount: Math.abs(ledgerData.Original_Amount), // Use Original_Amount from ledger
                    Payment_Method_Code: invoice.Payment_Method_Code || '', // Include payment method code
                    External_Document_No: ledgerData.External_Document_No || '' // Reference from vendor ledger
                };
            }
            else {
                // Fallback to invoice data if ledger entry not found
                return {
                    ...invoice,
                    Closed: invoice.Closed || false, // Use existing Closed field or default to false
                    Amount: invoice.Amount || 0, // Use existing Amount
                    Payment_Method_Code: invoice.Payment_Method_Code || '', // Include payment method code
                    External_Document_No: '' // No reference available
                };
            }
        });
        res.json({ invoices: enrichedInvoices, count: enrichedInvoices.length });
    }
    catch (error) {
        console.error('Error fetching purchase invoices from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch purchase invoices',
            details: error.response?.data || error.message
        });
    }
});
router.get('/salary-payments', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/SalariesList');
        const salaries = response.data.value || [];
        res.json({ salaries, count: salaries.length });
    }
    catch (error) {
        console.error('Error fetching salary payments from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch salary payments',
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/bank-accounts
 * Fetch bank accounts for payment journal
 */
router.get('/bank-accounts', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/Bank_Account_Card_Excel', {
            params: {
                $select: 'No,Name,Currency_Code'
            }
        });
        const bankAccounts = response.data.value || [];
        res.json({ bankAccounts, count: bankAccounts.length });
    }
    catch (error) {
        console.error('Error fetching bank accounts from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch bank accounts',
            details: error.response?.data || error.message
        });
    }
});
/**
 * POST /api/bc/payment-journal-line
 * Create payment journal lines for a purchase invoice using BC API v2.0
 * Creates TWO lines: one for Vendor (debit), one for Bank Account (credit)
 * Body: { vendorNo, vendorName, amount, documentNo, invoiceReference, bankAccountNo, paymentReference, bankCurrencyCode }
 */
router.post('/payment-journal-line', async (req, res) => {
    try {
        const { vendorNo, vendorName, amount, documentNo, invoiceReference, bankAccountNo, paymentReference, bankCurrencyCode } = req.body;
        console.log('Payment journal line request received:', {
            vendorNo,
            vendorName,
            amount,
            documentNo,
            invoiceReference, // This should be the Reference from the invoice list (External_Document_No)
            bankAccountNo,
            paymentReference,
            bankCurrencyCode
        });
        if (!vendorNo || !amount || !bankAccountNo) {
            return res.status(400).json({ error: 'vendorNo, amount, and bankAccountNo are required' });
        }
        // Use standard BC API v2.0 for journals
        const token = await getAccessToken();
        const bcApiUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies`;
        // First, get the company ID
        let companyId;
        try {
            const companiesResponse = await axios_1.default.get(bcApiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const companies = companiesResponse.data.value || [];
            const company = companies.find((c) => c.name === 'ARK Group Live' || c.displayName === 'ARK Group Live');
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }
            companyId = company.id;
        }
        catch (companyError) {
            console.error('Error fetching companies:', companyError.response?.data || companyError.message);
            return res.status(500).json({ error: 'Failed to fetch company', details: companyError.response?.data });
        }
        // Get or create PAYMENT journal batch
        const journalsUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals`;
        let journalId;
        try {
            const journalsResponse = await axios_1.default.get(journalsUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { $filter: "code eq 'PAYMENT'" }
            });
            const journals = journalsResponse.data.value || [];
            if (journals.length > 0) {
                journalId = journals[0].id;
            }
            else {
                // Create new journal if not found
                const createJournalResponse = await axios_1.default.post(journalsUrl, {
                    code: 'PAYMENT',
                    displayName: 'Payment Journal'
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                journalId = createJournalResponse.data.id;
            }
        }
        catch (journalError) {
            console.error('Error with journals:', journalError.response?.data || journalError.message);
            return res.status(500).json({ error: 'Failed to access payment journal', details: journalError.response?.data });
        }
        const journalLinesUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals(${journalId})/journalLines`;
        // Build description: "Payment for {Vendor Name} {Reference}" - max 100 chars
        // Reference is from invoice list (invoiceReference), NOT the payment reference
        const refFromInvoice = invoiceReference || '';
        let desc = `Payment for ${vendorName || vendorNo}${refFromInvoice ? ' ' + refFromInvoice : ''}`;
        if (desc.length > 100) {
            desc = desc.substring(0, 97) + '...';
        }
        const postingDate = new Date().toISOString().split('T')[0];
        const absAmount = Math.abs(amount);
        // LINE 1: Vendor line (DEBIT - positive amount)
        const vendorLine = {
            accountType: 'Vendor',
            accountNumber: vendorNo,
            postingDate: postingDate,
            documentNumber: paymentReference || '', // Payment reference goes to Document No.
            amount: absAmount, // Positive = Debit
            description: desc,
            externalDocumentNumber: refFromInvoice // Reference from invoice goes to External Document No.
        };
        console.log('Creating VENDOR journal line (DEBIT):', vendorLine);
        const vendorResponse = await axios_1.default.post(journalLinesUrl, vendorLine, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Vendor line created:', vendorResponse.data);
        // LINE 2: Bank Account line (CREDIT - negative amount)
        const bankLine = {
            accountType: 'Bank Account',
            accountNumber: bankAccountNo,
            postingDate: postingDate,
            documentNumber: paymentReference || '', // Same Document No.
            amount: -absAmount, // Negative = Credit
            description: desc,
            externalDocumentNumber: refFromInvoice // Same External Document No.
        };
        console.log('Creating BANK ACCOUNT journal line (CREDIT):', bankLine);
        const bankResponse = await axios_1.default.post(journalLinesUrl, bankLine, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Bank Account line created:', bankResponse.data);
        // Return the URL to open the General Journal page
        const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=39&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27GENERAL%27%20AND%20%27Gen.%20Journal%20Line%27.%27Journal%20Batch%20Name%27%20IS%20%27PAYMENT%27&dc=0';
        res.json({
            success: true,
            message: 'Payment journal lines created successfully (Vendor debit + Bank credit)',
            vendorLineId: vendorResponse.data.id,
            bankLineId: bankResponse.data.id,
            paymentUrl
        });
    }
    catch (error) {
        console.error('Error creating payment journal line:', error.response?.data || error.message);
        const bcError = error.response?.data?.error;
        let errorMessage = 'Failed to create payment journal line';
        if (bcError?.message) {
            errorMessage = bcError.message;
        }
        else if (error.message) {
            errorMessage = error.message;
        }
        res.status(error.response?.status || 500).json({
            error: errorMessage,
            details: error.response?.data || error.message
        });
    }
});
/**
 * POST /api/bc/customer-payment-journal-line
 * Create payment journal lines for receiving customer payment (receivables)
 * Creates TWO lines: one for Customer (credit), one for Bank Account (debit)
 * Body: { customerNo, customerName, amount, documentNo, description, invoiceNo, currencyCode, bankAccountNo, paymentReference, bankCurrencyCode }
 */
router.post('/customer-payment-journal-line', async (req, res) => {
    try {
        const { customerNo, customerName, amount, documentNo, description, invoiceNo, currencyCode, bankAccountNo, paymentReference, bankCurrencyCode } = req.body;
        console.log('Customer payment journal line request received:', {
            customerNo,
            customerName,
            amount,
            documentNo,
            description,
            invoiceNo,
            currencyCode,
            bankAccountNo,
            paymentReference,
            bankCurrencyCode
        });
        if (!customerNo || !amount || !bankAccountNo) {
            return res.status(400).json({ error: 'customerNo, amount, and bankAccountNo are required' });
        }
        // Use standard BC API v2.0 for journals
        const token = await getAccessToken();
        const bcApiUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies`;
        // First, get the company ID
        let companyId;
        try {
            const companiesResponse = await axios_1.default.get(bcApiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const companies = companiesResponse.data.value || [];
            const company = companies.find((c) => c.name === 'ARK Group Live' || c.displayName === 'ARK Group Live');
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }
            companyId = company.id;
        }
        catch (companyError) {
            console.error('Error fetching companies:', companyError.response?.data || companyError.message);
            return res.status(500).json({ error: 'Failed to fetch company', details: companyError.response?.data });
        }
        // Get or create CASHRECPT journal batch (Cash Receipt Journal)
        const journalsUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals`;
        let journalId;
        try {
            const journalsResponse = await axios_1.default.get(journalsUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { $filter: "code eq 'CASHRECPT'" }
            });
            const journals = journalsResponse.data.value || [];
            if (journals.length > 0) {
                journalId = journals[0].id;
            }
            else {
                // Create new journal if not found
                const createJournalResponse = await axios_1.default.post(journalsUrl, {
                    code: 'CASHRECPT',
                    displayName: 'Cash Receipt Journal'
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                journalId = createJournalResponse.data.id;
            }
        }
        catch (journalError) {
            console.error('Error with journals:', journalError.response?.data || journalError.message);
            return res.status(500).json({ error: 'Failed to access cash receipt journal', details: journalError.response?.data });
        }
        const journalLinesUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals(${journalId})/journalLines`;
        const postingDate = new Date().toISOString().split('T')[0];
        const absAmount = Math.abs(amount);
        // LINE 1: Customer line (CREDIT - negative amount since we're receiving money)
        // Document No = Invoice No, Description = Description from invoice, External Doc = Invoice No
        // Note: Currency is determined by the customer/bank account setup in BC, not passed via API
        const customerLine = {
            accountType: 'Customer',
            accountNumber: customerNo,
            postingDate: postingDate,
            documentNumber: invoiceNo || documentNo || '', // Document No = Invoice No
            amount: -absAmount, // Negative = Credit (receiving money reduces customer balance)
            description: description || `Receipt from ${customerName || customerNo}`,
            externalDocumentNumber: invoiceNo || '' // Vendor Invoice Ref = Invoice No
        };
        console.log('Creating CUSTOMER journal line (CREDIT):', customerLine);
        const customerResponse = await axios_1.default.post(journalLinesUrl, customerLine, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Customer line created:', customerResponse.data);
        // LINE 2: Bank Account line (DEBIT - positive amount since we're receiving money)
        // Note: Currency is determined by the bank account setup in BC, not passed via API
        const bankLine = {
            accountType: 'Bank Account',
            accountNumber: bankAccountNo,
            postingDate: postingDate,
            documentNumber: invoiceNo || documentNo || '', // Same Document No.
            amount: absAmount, // Positive = Debit (bank balance increases)
            description: description || `Receipt from ${customerName || customerNo}`,
            externalDocumentNumber: invoiceNo || '' // Same External Document No.
        };
        console.log('Creating BANK ACCOUNT journal line (DEBIT):', bankLine);
        const bankResponse = await axios_1.default.post(journalLinesUrl, bankLine, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Bank Account line created:', bankResponse.data);
        // Return the URL to open the Cash Receipt Journal page filtered to CASHRECPT batch
        const paymentUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=39&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27GENERAL%27%20AND%20%27Gen.%20Journal%20Line%27.%27Journal%20Batch%20Name%27%20IS%20%27CASHRECPT%27&dc=0`;
        res.json({
            success: true,
            message: 'Customer payment journal lines created successfully (Customer credit + Bank debit)',
            customerLineId: customerResponse.data.id,
            bankLineId: bankResponse.data.id,
            paymentUrl
        });
    }
    catch (error) {
        console.error('Error creating customer payment journal line:', error.response?.data || error.message);
        const bcError = error.response?.data?.error;
        let errorMessage = 'Failed to create customer payment journal line';
        if (bcError?.message) {
            errorMessage = bcError.message;
        }
        else if (error.message) {
            errorMessage = error.message;
        }
        res.status(error.response?.status || 500).json({
            error: errorMessage,
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/vendor-cards
 * Fetch full vendor list from Vendor_Card_Excel for employee selection in salary payments
 */
router.get('/vendor-cards', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const response = await bcClient.get('/Vendor_Card_Excel', {
            params: {
                $select: 'No,Name,Currency_Code'
            }
        });
        const vendors = response.data.value || [];
        res.json({ vendors, count: vendors.length });
    }
    catch (error) {
        console.error('Error fetching vendor cards from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch vendor cards',
            details: error.response?.data || error.message
        });
    }
});
/**
 * POST /api/bc/salary-payment-journal-lines
 * Create payment journal lines for salary payments (multiple vendors)
 * Creates TWO lines per vendor: one for Vendor (debit), one for Bank Account (credit)
 * Body: { bankAccountNo, bankCurrencyCode, payrollMonth (MM/YYYY), employees: [{ vendorNo, vendorName, paymentReference, amount }] }
 */
router.post('/salary-payment-journal-lines', async (req, res) => {
    try {
        const { bankAccountNo, bankCurrencyCode, payrollMonth, employees } = req.body;
        console.log('Salary payment journal request received:', {
            bankAccountNo,
            bankCurrencyCode,
            payrollMonth,
            employeeCount: employees?.length
        });
        if (!bankAccountNo || !payrollMonth || !employees || employees.length === 0) {
            return res.status(400).json({ error: 'bankAccountNo, payrollMonth, and at least one employee are required' });
        }
        // Use standard BC API v2.0 for journals
        const token = await getAccessToken();
        const bcApiUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies`;
        // Get company ID
        let companyId;
        try {
            const companiesResponse = await axios_1.default.get(bcApiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const companies = companiesResponse.data.value || [];
            const company = companies.find((c) => c.name === 'ARK Group Live' || c.displayName === 'ARK Group Live');
            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }
            companyId = company.id;
        }
        catch (companyError) {
            console.error('Error fetching companies:', companyError.response?.data || companyError.message);
            return res.status(500).json({ error: 'Failed to fetch company', details: companyError.response?.data });
        }
        // Get or create PAYMENT journal batch
        const journalsUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals`;
        let journalId;
        try {
            const journalsResponse = await axios_1.default.get(journalsUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { $filter: "code eq 'PAYMENT'" }
            });
            const journals = journalsResponse.data.value || [];
            if (journals.length > 0) {
                journalId = journals[0].id;
            }
            else {
                const createJournalResponse = await axios_1.default.post(journalsUrl, {
                    code: 'PAYMENT',
                    displayName: 'Payment Journal'
                }, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                journalId = createJournalResponse.data.id;
            }
        }
        catch (journalError) {
            console.error('Error with journals:', journalError.response?.data || journalError.message);
            return res.status(500).json({ error: 'Failed to access payment journal', details: journalError.response?.data });
        }
        const journalLinesUrl = `https://api.businesscentral.dynamics.com/v2.0/${BC_TENANT_ID}/Production/api/v2.0/companies(${companyId})/journals(${journalId})/journalLines`;
        const postingDate = new Date().toISOString().split('T')[0];
        const results = [];
        const errors = [];
        // Create journal lines for each employee
        for (const employee of employees) {
            const { vendorNo, vendorName, paymentReference, amount } = employee;
            if (!vendorNo || !amount) {
                errors.push({ vendorNo, error: 'Missing vendorNo or amount' });
                continue;
            }
            // Description: "Salary for {Vendor Name} {Month/Year}" - max 100 chars
            let desc = `Salary for ${vendorName || vendorNo} ${payrollMonth}`;
            if (desc.length > 100) {
                desc = desc.substring(0, 97) + '...';
            }
            const absAmount = Math.abs(amount);
            try {
                // LINE 1: Vendor line (DEBIT - positive amount)
                const vendorLine = {
                    accountType: 'Vendor',
                    accountNumber: vendorNo,
                    postingDate: postingDate,
                    documentNumber: paymentReference || '', // Payment reference as Document No.
                    amount: absAmount, // Positive = Debit
                    description: desc,
                    externalDocumentNumber: payrollMonth // Month/Year as External Document No. (Vendor Invoice Ref)
                };
                console.log(`Creating VENDOR journal line for ${vendorName}:`, vendorLine);
                const vendorResponse = await axios_1.default.post(journalLinesUrl, vendorLine, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`✅ Vendor line created for ${vendorName}`);
                // LINE 2: Bank Account line (CREDIT - negative amount)
                const bankLine = {
                    accountType: 'Bank Account',
                    accountNumber: bankAccountNo,
                    postingDate: postingDate,
                    documentNumber: paymentReference || '', // Same Document No.
                    amount: -absAmount, // Negative = Credit
                    description: desc,
                    externalDocumentNumber: payrollMonth // Same External Document No.
                };
                console.log(`Creating BANK ACCOUNT journal line for ${vendorName}:`, bankLine);
                const bankResponse = await axios_1.default.post(journalLinesUrl, bankLine, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`✅ Bank Account line created for ${vendorName}`);
                results.push({
                    vendorNo,
                    vendorName,
                    amount: absAmount,
                    vendorLineId: vendorResponse.data.id,
                    bankLineId: bankResponse.data.id,
                    success: true
                });
            }
            catch (empError) {
                console.error(`Error creating journal lines for ${vendorName}:`, empError.response?.data || empError.message);
                errors.push({
                    vendorNo,
                    vendorName,
                    error: empError.response?.data?.error?.message || empError.message
                });
            }
        }
        const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=39&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27GENERAL%27%20AND%20%27Gen.%20Journal%20Line%27.%27Journal%20Batch%20Name%27%20IS%20%27PAYMENT%27&dc=0';
        res.json({
            success: errors.length === 0,
            message: errors.length === 0
                ? `Successfully created journal lines for ${results.length} employees`
                : `Created journal lines for ${results.length} employees, ${errors.length} failed`,
            results,
            errors,
            paymentUrl
        });
    }
    catch (error) {
        console.error('Error creating salary payment journal lines:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to create salary payment journal lines',
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/journal-batches
 * Get available journal batches for a template
 * Query params: templateName (default: PAYMENT)
 */
router.get('/journal-batches', async (req, res) => {
    try {
        const templateName = req.query.templateName || 'PAYMENT';
        const bcClient = await createBCClient();
        const response = await bcClient.get('/Gen_Journal_Batch', {
            params: {
                $filter: `Journal_Template_Name eq '${templateName}'`
            }
        });
        const batches = response.data.value || [];
        res.json({ batches });
    }
    catch (error) {
        console.error('Error fetching journal batches from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch journal batches',
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/posted-sales-invoices
 * Fetch posted sales invoices from Business Central with descriptions from GL entries
 * Query params: $top, $skip, $filter, $select (optional OData parameters)
 */
router.get('/posted-sales-invoices', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        // Forward any OData query parameters
        const params = {};
        if (req.query.$top)
            params.$top = req.query.$top;
        if (req.query.$skip)
            params.$skip = req.query.$skip;
        if (req.query.$filter)
            params.$filter = req.query.$filter;
        if (req.query.$select)
            params.$select = req.query.$select;
        const response = await bcClient.get('/postedsalesinvoices', { params });
        const invoices = response.data.value || [];
        // Fetch descriptions from General Ledger Entries for each invoice
        const invoicesWithDescriptions = await Promise.all(invoices.map(async (invoice) => {
            try {
                // Get GL entries for this document number
                const glResponse = await bcClient.get('/General_Ledger_Entries_Excel', {
                    params: {
                        $filter: `Document_No eq '${invoice.No}'`,
                        $select: 'Description',
                        $top: 1
                    }
                });
                const glEntries = glResponse.data.value || [];
                const description = glEntries.length > 0 ? glEntries[0].Description : '';
                return {
                    ...invoice,
                    Description: description
                };
            }
            catch (glError) {
                console.warn(`Could not fetch GL entry for invoice ${invoice.No}:`, glError);
                return {
                    ...invoice,
                    Description: ''
                };
            }
        }));
        res.json({
            invoices: invoicesWithDescriptions,
            count: invoicesWithDescriptions.length,
            '@odata.context': response.data['@odata.context']
        });
    }
    catch (error) {
        console.error('Error fetching posted sales invoices from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch posted sales invoices',
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/jobledgerentries
 * Fetch job ledger entries from custom API to see available fields
 * Query params: $top, $filter, $select, etc.
 */
router.get('/jobledgerentries', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        // Forward all query parameters
        const params = { ...req.query };
        // Default to top 5 to see sample data
        if (!params.$top) {
            params.$top = 5;
        }
        // Use standard custom API path format
        const response = await bcClient.get('/api/ark/finance/v1.0/jobLedgerEntries', { params });
        res.json({
            entries: response.data.value || [],
            count: (response.data.value || []).length,
            '@odata.context': response.data['@odata.context'],
            '@odata.nextLink': response.data['@odata.nextLink']
        });
    }
    catch (error) {
        console.error('Error fetching job ledger entries from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch job ledger entries',
            details: error.response?.data || error.message
        });
    }
});
/**
 * GET /api/bc/jlentries
 * Test endpoint to check what fields are available from the jlentries API
 */
router.get('/jlentries', async (req, res) => {
    try {
        const bcClient = await createBCClient();
        const filter = req.query.$filter;
        const top = req.query.$top ? parseInt(req.query.$top) : 1;
        const response = await bcClient.get('/jlentries', {
            params: {
                $top: top,
                ...(filter && { $filter: filter })
            }
        });
        const entries = response.data.value || [];
        // If we have entries, show the field names
        const fields = entries.length > 0 ? Object.keys(entries[0]).sort() : [];
        res.json({
            entries: entries,
            count: entries.length,
            availableFields: fields,
            '@odata.context': response.data['@odata.context']
        });
    }
    catch (error) {
        console.error('Error fetching jlentries from BC:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch jlentries',
            details: error.response?.data || error.message
        });
    }
});
exports.default = router;
