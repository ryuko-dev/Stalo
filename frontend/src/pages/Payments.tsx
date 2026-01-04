/**
 * Payments Page
 * Displays 4 sections: Salary, Personnel, Purchase Invoices, and Prepayments
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { 
  Folder as FolderIcon, 
  Refresh as RefreshIcon, 
  Search as SearchIcon,
  Payment as PaymentIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { getPersonnelExpenses, getPrepayments, getPurchaseInvoices, getSalaryPayments, getVendors } from '../services/paymentService';
import { convertToUSD } from '../services/exchangeRateService';
import type { PersonnelExpense, Prepayment, PurchaseInvoice, SalaryPayment } from '../types/payments';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Payments() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    expense: PersonnelExpense | null;
  } | null>(null);
  
  const [prepaymentContextMenu, setPrepaymentContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    prepayment: Prepayment | null;
  } | null>(null);
  
  const [purchaseInvoiceContextMenu, setPurchaseInvoiceContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    invoice: PurchaseInvoice | null;
  } | null>(null);
  const [salaryContextMenu, setSalaryContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    salary: SalaryPayment | null;
  } | null>(null);

  // Data states
  const [personnelExpenses, setPersonnelExpenses] = useState<PersonnelExpense[]>([]);
  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [vendorLookup, setVendorLookup] = useState<Map<string, string>>(new Map());
  const [usdAmounts, setUsdAmounts] = useState<{ [currency: string]: number }>({});

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Sort purchase invoices by Posting_Date, newest at the end
  const sortedPurchaseInvoices = [...purchaseInvoices].sort((a, b) => {
    const dateA = new Date(a.Posting_Date || '1900-01-01').getTime();
    const dateB = new Date(b.Posting_Date || '1900-01-01').getTime();
    return dateA - dateB;
  });

  // Group purchase invoices by Payment_Method_Code (blank = "BANK TRAN")
  const groupedPurchaseInvoices = sortedPurchaseInvoices.reduce((groups, invoice) => {
    const paymentMethod = invoice.Payment_Method_Code?.trim() || 'BANK TRAN';
    if (!groups[paymentMethod]) {
      groups[paymentMethod] = [];
    }
    groups[paymentMethod].push(invoice);
    return groups;
  }, {} as Record<string, PurchaseInvoice[]>);

  const paymentMethodKeys = Object.keys(groupedPurchaseInvoices).sort();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [personnel, prepaid, purchase, salary, vendors] = await Promise.all([
        getPersonnelExpenses(false), // Always fetch all
        getPrepayments(true), // Always fetch all prepayments, filter on frontend
        getPurchaseInvoices(),
        getSalaryPayments(),
        getVendors(), // Fetch vendors for lookup
      ]);
      
      // Create vendor name -> number lookup map
      const lookup = new Map<string, string>();
      vendors.forEach(v => {
        if (v.name && v.number) {
          lookup.set(v.name.trim(), v.number);
        }
      });
      setVendorLookup(lookup);
      
      // No filtering - show all personnel expenses
      setPersonnelExpenses(personnel);
      setPrepayments(prepaid);
      
      // Filter purchase invoices to show only Closed=No and non-empty Amount
      const filteredPurchaseInvoices = purchase.filter(inv => 
        !inv.Closed && inv.Amount && inv.Amount !== 0
      );
      setPurchaseInvoices(filteredPurchaseInvoices);
      
      // Filter salary payments to show only items where Status is not 'Complete'
      const filteredSalaryPayments = salary.filter(sal => sal.Status !== 'Complete');
      setSalaryPayments(filteredSalaryPayments);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment data');
      console.error('Error fetching payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // No dependencies since we removed show all filters

  const handleFolderClick = (folderUrl: string) => {
    if (folderUrl) {
      window.open(folderUrl, '_blank');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + currency;
  };

  const getStatusLabel = (expense: PersonnelExpense) => {
    // Access properties directly by name
    const approverOneDatetime = expense.Approver_One_Datetime;
    const approverTwoDatetime = expense.Approver_Two_Datetime; // Capital T in Two
    
    // Check if values exist and are not empty/null/undefined/default dates
    const hasApproverOne = approverOneDatetime && 
                          String(approverOneDatetime).trim().length > 0 &&
                          !String(approverOneDatetime).startsWith('0001-01-01') &&
                          !String(approverOneDatetime).startsWith('1900-01-01');
    const hasApproverTwo = approverTwoDatetime && 
                          String(approverTwoDatetime).trim().length > 0 &&
                          !String(approverTwoDatetime).startsWith('0001-01-01') &&
                          !String(approverTwoDatetime).startsWith('1900-01-01');
    
    // If BOTH approvers have values, it's approved
    // If EITHER is blank/missing, it's pending approval
    if (hasApproverOne && hasApproverTwo) {
      return { label: 'Approved', color: 'success' as const };
    }
    return { label: 'Pending Approval', color: 'warning' as const };
  };

  const getPrepaymentStatus = (prepayment: Prepayment) => {
    const approverOneDatetime = prepayment.Approver_One_Datetime;
    const approverTwoDatetime = prepayment.Approver_Two_Datetime;
    
    const hasApproverOne = approverOneDatetime && 
                          String(approverOneDatetime).trim().length > 0 &&
                          !String(approverOneDatetime).startsWith('0001-01-01') &&
                          !String(approverOneDatetime).startsWith('1900-01-01');
    const hasApproverTwo = approverTwoDatetime && 
                          String(approverTwoDatetime).trim().length > 0 &&
                          !String(approverTwoDatetime).startsWith('0001-01-01') &&
                          !String(approverTwoDatetime).startsWith('1900-01-01');
    
    if (hasApproverOne && hasApproverTwo) {
      return { label: 'Approved', color: 'success' as const };
    }
    return { label: 'Pending Approval', color: 'warning' as const };
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '0001-01-01T00:00:00' || dateString === '1900-01-01T00:00:00') {
      return '-';
    }
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return '-';
    }
  };

  const calculateAging = (requestDateString: string): number | string => {
    if (!requestDateString || requestDateString === '0001-01-01T00:00:00' || requestDateString === '1900-01-01T00:00:00') {
      return '-';
    }
    try {
      const requestDate = new Date(requestDateString);
      const today = new Date();
      const diffTime = today.getTime() - requestDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return '-';
    }
  };

  const handleContextMenu = (event: React.MouseEvent, expense: PersonnelExpense) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            expense,
          }
        : null,
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handlePayClick = () => {
    const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=256&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27PAYMENT%27&dc=0';
    window.open(paymentUrl, '_blank');
    handleCloseContextMenu();
  };

  const handleSeeTransactionClick = () => {
    if (contextMenu?.expense?.No) {
      // Encode the No field for use in the bookmark
      const encodedNo = encodeURIComponent(contextMenu.expense.No);
      // Build the Business Central URL with the bookmark filter
      const transactionUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=63103&filter=%27Personnel%20Expenses%27.%27No.%27%20IS%20%27${encodedNo}%27&dc=0`;
      window.open(transactionUrl, '_blank');
    }
    handleCloseContextMenu();
  };

  const handleShowVendorClick = () => {
    if (contextMenu?.expense) {
      // Get vendor ID from Vendor field
      const vendorId = contextMenu.expense.Vendor;
      if (vendorId) {
        // Build the Business Central Vendor Ledger Entry URL
        const vendorUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=29&filter=%27Vendor%20Ledger%20Entry%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(vendorUrl, '_blank');
      }
    }
    handleCloseContextMenu();
  };

  const handleBankAccountClick = () => {
    if (contextMenu?.expense) {
      const vendorId = contextMenu.expense.Vendor;
      if (vendorId) {
        const bankAccountUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=425&filter=%27Vendor%20Bank%20Account%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(bankAccountUrl, '_blank');
      }
    }
    handleCloseContextMenu();
  };

  // Prepayment context menu handlers
  const handlePrepaymentContextMenu = (event: React.MouseEvent, prepayment: Prepayment) => {
    event.preventDefault();
    setPrepaymentContextMenu(
      prepaymentContextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            prepayment,
          }
        : null,
    );
  };

  const handleClosePrepaymentContextMenu = () => {
    setPrepaymentContextMenu(null);
  };

  const handlePrepaymentPayClick = () => {
    const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=256&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27PAYMENT%27&dc=0';
    window.open(paymentUrl, '_blank');
    handleClosePrepaymentContextMenu();
  };

  const handlePrepaymentShowVendorClick = () => {
    if (prepaymentContextMenu?.prepayment) {
      const prepayment = prepaymentContextMenu.prepayment;
      // Look up vendor ID from vendor name
      const vendorId = prepayment.Vendor_Name ? vendorLookup.get(prepayment.Vendor_Name.trim()) : undefined;
      if (vendorId) {
        const vendorUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=29&filter=%27Vendor%20Ledger%20Entry%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(vendorUrl, '_blank');
      }
    }
    handleClosePrepaymentContextMenu();
  };

  const handlePrepaymentBankAccountClick = () => {
    if (prepaymentContextMenu?.prepayment) {
      const prepayment = prepaymentContextMenu.prepayment;
      const vendorId = prepayment.Vendor_Name ? vendorLookup.get(prepayment.Vendor_Name.trim()) : undefined;
      if (vendorId) {
        const bankAccountUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=425&filter=%27Vendor%20Bank%20Account%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(bankAccountUrl, '_blank');
      }
    }
    handleClosePrepaymentContextMenu();
  };

  const handlePrepaymentSeeTransactionClick = () => {
    if (prepaymentContextMenu?.prepayment) {
      const prepaymentNo = prepaymentContextMenu.prepayment.No;
      // Open list view with exact BC filter format: Prepayment.%27No.%27 (note the period in field name)
      const transactionUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=61100&filter=Prepayment.%27No.%27%20IS%20%27${prepaymentNo}%27&dc=0`;
      window.open(transactionUrl, '_blank');
    }
    handleClosePrepaymentContextMenu();
  };

  const handlePrepaymentOpenFolderClick = () => {
    if (prepaymentContextMenu?.prepayment) {
      const folderUrl = prepaymentContextMenu.prepayment.Folder;
      if (folderUrl && folderUrl.trim() !== '') {
        window.open(folderUrl, '_blank');
      }
    }
    handleClosePrepaymentContextMenu();
  };

  // Purchase Invoice context menu handlers
  const handlePurchaseInvoiceContextMenu = (event: React.MouseEvent, invoice: PurchaseInvoice) => {
    event.preventDefault();
    setPurchaseInvoiceContextMenu(
      purchaseInvoiceContextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            invoice,
          }
        : null,
    );
  };

  const handleClosePurchaseInvoiceContextMenu = () => {
    setPurchaseInvoiceContextMenu(null);
  };

  const handlePurchaseInvoicePayClick = () => {
    const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=256&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27PAYMENT%27&dc=0';
    window.open(paymentUrl, '_blank');
    handleClosePurchaseInvoiceContextMenu();
  };

  const handlePurchaseInvoiceShowVendorClick = () => {
    if (purchaseInvoiceContextMenu?.invoice) {
      const vendorId = purchaseInvoiceContextMenu.invoice.Buy_from_Vendor_No;
      if (vendorId) {
        const vendorUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=29&filter=%27Vendor%20Ledger%20Entry%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(vendorUrl, '_blank');
      }
    }
    handleClosePurchaseInvoiceContextMenu();
  };

  const handlePurchaseInvoiceBankAccountClick = () => {
    if (purchaseInvoiceContextMenu?.invoice) {
      const vendorId = purchaseInvoiceContextMenu.invoice.Buy_from_Vendor_No;
      if (vendorId) {
        const bankAccountUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=425&filter=%27Vendor%20Bank%20Account%27.%27Vendor%20No.%27%20IS%20%27${vendorId}%27&dc=0`;
        window.open(bankAccountUrl, '_blank');
      }
    }
    handleClosePurchaseInvoiceContextMenu();
  };

  const handlePurchaseInvoiceSeeTransactionClick = () => {
    if (purchaseInvoiceContextMenu?.invoice) {
      const invoiceNo = purchaseInvoiceContextMenu.invoice.No;
      const transactionUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=138&filter=%27Purch.%20Inv.%20Header%27.%27No.%27%20IS%20%27${invoiceNo}%27&dc=0`;
      window.open(transactionUrl, '_blank');
    }
    handleClosePurchaseInvoiceContextMenu();
  };

  const handlePurchaseInvoiceOpenFolderClick = () => {
    if (purchaseInvoiceContextMenu?.invoice?.Folder_Link) {
      const folderUrl = purchaseInvoiceContextMenu.invoice.Folder_Link;
      if (folderUrl && folderUrl.trim() !== '') {
        window.open(folderUrl, '_blank');
      }
    }
    handleClosePurchaseInvoiceContextMenu();
  };

  // Salary context menu handlers
  const handleSalaryContextMenu = (event: React.MouseEvent, salary: SalaryPayment) => {
    event.preventDefault();
    setSalaryContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      salary,
    });
  };

  const handleCloseSalaryContextMenu = () => {
    setSalaryContextMenu(null);
  };

  const handleSalaryOpenFolderClick = () => {
    window.open('https://arkgroupdmcc.sharepoint.com/sites/BusinessCentral-Data/Business%20Central%20Payroll/Forms/AllItems.aspx', '_blank');
    handleCloseSalaryContextMenu();
  };

  const handleSalaryShowTransactionClick = () => {
    if (salaryContextMenu?.salary?.No) {
      const salaryNo = salaryContextMenu.salary.No;
      const url = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&view=aa49406f-6f68-4565-b857-496faa0e77aa_test88647&page=63102&filter=Salaries.%27No.%27%20IS%20%27${salaryNo}%27&dc=0`;
      window.open(url, '_blank');
    }
    handleCloseSalaryContextMenu();
  };

  const handleSalaryPayClick = () => {
    const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=256&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27PAYMENT%27&dc=0';
    window.open(paymentUrl, '_blank');
    handleCloseSalaryContextMenu();
  };

  // Calculate summary by currency and category
  const getSummaryData = () => {
    const summary: { [currency: string]: { [category: string]: number } } = {};
    
    // Add Personnel expenses
    filteredPersonnelExpenses.forEach(expense => {
      const currency = expense.Currency || 'N/A';
      if (!summary[currency]) summary[currency] = {};
      if (!summary[currency]['Personnel']) summary[currency]['Personnel'] = 0;
      summary[currency]['Personnel'] += expense.Amount || 0;
    });

    // Add Prepayments
    filteredPrepayments.forEach(prepayment => {
      const currency = prepayment.Currency || 'N/A';
      if (!summary[currency]) summary[currency] = {};
      if (!summary[currency]['Prepayments']) summary[currency]['Prepayments'] = 0;
      summary[currency]['Prepayments'] += prepayment.Prepayment_Amount || 0;
    });

    // Add Purchase Invoices
    purchaseInvoices.forEach(invoice => {
      const currency = invoice.Currency_Code || 'N/A';
      if (!summary[currency]) summary[currency] = {};
      if (!summary[currency]['Purchase Invoices']) summary[currency]['Purchase Invoices'] = 0;
      summary[currency]['Purchase Invoices'] += invoice.Amount || 0;
    });

    // Add Salary Payments
    salaryPayments.forEach(salary => {
      const currency = salary.Currency || 'N/A';
      if (!summary[currency]) summary[currency] = {};
      if (!summary[currency]['Salary']) summary[currency]['Salary'] = 0;
      summary[currency]['Salary'] += salary.Payroll_Amount || 0;
    });

    return summary;
  };

  // Convert summary totals to USD
  useEffect(() => {
    const calculateUSDAmounts = async () => {
      const summary = getSummaryData();
      const usdConversions: { [currency: string]: number } = {};
      
      for (const [currency, categories] of Object.entries(summary)) {
        const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
        usdConversions[currency] = await convertToUSD(total, currency);
      }
      
      setUsdAmounts(usdConversions);
    };
    
    if (!loading) {
      calculateUSDAmounts();
    }
  }, [personnelExpenses, prepayments, purchaseInvoices, salaryPayments, loading]);

  // Filter data based on search term
  const filteredPersonnelExpenses = personnelExpenses.filter(expense => {
    // Default filter: blank Payment_Reference AND Status not Draft
    const hasBlankPaymentRef = !expense.Payment_Reference || expense.Payment_Reference.trim() === '';
    const isNotDraft = expense.Status !== 'Draft';
    if (!hasBlankPaymentRef || !isNotDraft) return false;
    
    // Only filter by search term, no payment reference filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (expense.Vendor || '').toLowerCase().includes(search) ||
      (expense.Vendor_Name || '').toLowerCase().includes(search) ||
      (expense.Type || '').toLowerCase().includes(search) ||
      (expense.Project || '').toLowerCase().includes(search)
    );
  }).sort((a, b) => {
    // Sort by Approval_Requested_By_Datetime, newest at the end
    const dateA = new Date(a.Approval_Requested_By_Datetime || '1900-01-01').getTime();
    const dateB = new Date(b.Approval_Requested_By_Datetime || '1900-01-01').getTime();
    return dateA - dateB;
  });

  const filteredPrepayments = prepayments.filter(prepayment => {
    // Default filter: blank Payment_Reference AND Approved status
    const hasBlankPaymentRef = !prepayment.Payment_Reference || prepayment.Payment_Reference.trim() === '';
    if (!hasBlankPaymentRef) return false;
    
    // Only show Approved items (both approver datetimes must have valid dates)
    const status = getPrepaymentStatus(prepayment);
    if (status.label !== 'Approved') return false;
    
    // Filter by search term
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (prepayment.Vendor || '').toLowerCase().includes(search) ||
      (prepayment.Vendor_Name || '').toLowerCase().includes(search) ||
      (prepayment.No || '').toLowerCase().includes(search)
    );
  }).sort((a, b) => {
    // Sort by Advance_Submission_Date (posting date), newest at the end
    const dateA = new Date(a.Advance_Submission_Date || '1900-01-01').getTime();
    const dateB = new Date(b.Advance_Submission_Date || '1900-01-01').getTime();
    return dateA - dateB;
  });

  // Group prepayments by Payment_Method (blank = "BANK TRAN")
  const groupedPrepayments = filteredPrepayments.reduce((groups, prepayment) => {
    const paymentMethod = prepayment.Payment_Method?.trim() || 'BANK TRAN';
    if (!groups[paymentMethod]) {
      groups[paymentMethod] = [];
    }
    groups[paymentMethod].push(prepayment);
    return groups;
  }, {} as Record<string, Prepayment[]>);

  const prepaymentMethodKeys = Object.keys(groupedPrepayments).sort();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Payments
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <IconButton onClick={() => fetchData()} disabled={loading} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Summary" />
          <Tab label={`Personnel (${filteredPersonnelExpenses.length})`} />
          <Tab label={`Prepayments (${filteredPrepayments.length})`} />
          <Tab label={`Purchase Invoices (${purchaseInvoices.length})`} />
          <Tab label={`Salary (${salaryPayments.length})`} />
        </Tabs>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Summary Tab */}
        <TabPanel value={activeTab} index={0}>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Personnel</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Prepayments</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Purchase Invoices</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Salary</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Total</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>USD Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(getSummaryData()).map(([currency, categories], index) => {
                  const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
                  return (
                    <TableRow 
                      key={currency}
                      sx={{ 
                        bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                        '&:hover': { bgcolor: 'action.selected' }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 'bold' }}>{currency}</TableCell>
                      <TableCell align="right">{formatCurrency(categories['Personnel'] || 0, currency)}</TableCell>
                      <TableCell align="right">{formatCurrency(categories['Prepayments'] || 0, currency)}</TableCell>
                      <TableCell align="right">{formatCurrency(categories['Purchase Invoices'] || 0, currency)}</TableCell>
                      <TableCell align="right">{formatCurrency(categories['Salary'] || 0, currency)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(total, currency)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {usdAmounts[currency] ? formatCurrency(usdAmounts[currency], 'USD') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(getSummaryData()).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No pending payments
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {Object.keys(getSummaryData()).length > 0 && (
                  <TableRow sx={{ bgcolor: 'action.selected', borderTop: 2, borderColor: 'primary.main' }}>
                    <TableCell colSpan={6} align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      Grand Total:
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}>
                      {formatCurrency(
                        Object.values(usdAmounts).reduce((sum, val) => sum + val, 0),
                        'USD'
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Personnel Tab */}
        <TabPanel value={activeTab} index={1}>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor ID</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Project</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Requested Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Aging</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPersonnelExpenses.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm ? 'No results found' : 'No personnel expenses found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {filteredPersonnelExpenses.map((expense, index) => {
                  const status = getStatusLabel(expense);
                  return (
                    <TableRow 
                      key={index} 
                      hover
                      onContextMenu={(e) => handleContextMenu(e, expense)}
                      sx={{ 
                        cursor: 'context-menu',
                        bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                        '&:hover': { bgcolor: 'action.selected' }
                      }}
                    >
                      <TableCell>{expense.No || '-'}</TableCell>
                      <TableCell>{expense.Vendor || '-'}</TableCell>
                      <TableCell>{expense.Vendor_Name || '-'}</TableCell>
                      <TableCell>{expense.Type || '-'}</TableCell>
                      <TableCell>{expense.Project || '-'}</TableCell>
                      <TableCell>{formatDate(expense.Approval_Requested_By_Datetime)}</TableCell>
                      <TableCell>{expense.Currency || '-'}</TableCell>
                      <TableCell align="right">
                        {expense.Amount ? formatCurrency(expense.Amount, expense.Currency) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip label={status.label} color={status.color} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        {typeof calculateAging(expense.Approval_Requested_By_Datetime) === 'number' 
                          ? `${calculateAging(expense.Approval_Requested_By_Datetime)} days`
                          : calculateAging(expense.Approval_Requested_By_Datetime)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Prepayments Tab */}
        <TabPanel value={activeTab} index={2}>
          {filteredPrepayments.length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              {searchTerm ? 'No results found' : 'No prepayments found'}
            </Typography>
          ) : (
            prepaymentMethodKeys.map((paymentMethod) => (
              <Box key={paymentMethod} sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                  {paymentMethod}
                </Typography>
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor ID</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Posting Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Aging</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedPrepayments[paymentMethod].map((prepayment, index) => {
                        const status = getPrepaymentStatus(prepayment);
                        const vendorId = prepayment.Vendor_Name ? vendorLookup.get(prepayment.Vendor_Name.trim()) : undefined;
                        return (
                          <TableRow 
                            key={index} 
                            hover
                            onContextMenu={(e) => handlePrepaymentContextMenu(e, prepayment)}
                            sx={{ cursor: 'context-menu' }}
                          >
                            <TableCell>{prepayment.No || '-'}</TableCell>
                            <TableCell>{vendorId || '-'}</TableCell>
                            <TableCell>{prepayment.Vendor_Name || '-'}</TableCell>
                            <TableCell>{formatDate(prepayment.Advance_Submission_Date)}</TableCell>
                            <TableCell>{prepayment.Currency || '-'}</TableCell>
                            <TableCell align="right">
                              {prepayment.Prepayment_Amount ? formatCurrency(prepayment.Prepayment_Amount, prepayment.Currency) : '-'}
                            </TableCell>
                            <TableCell>
                              <Chip label={status.label} color={status.color} size="small" />
                            </TableCell>
                            <TableCell align="right">
                              {typeof calculateAging(prepayment.Advance_Submission_Date) === 'number' 
                                ? `${calculateAging(prepayment.Advance_Submission_Date)} days`
                                : calculateAging(prepayment.Advance_Submission_Date)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))
          )}
        </TabPanel>

        {/* Purchase Invoices Tab */}
        <TabPanel value={activeTab} index={3}>
          {sortedPurchaseInvoices.length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              No purchase invoices found
            </Typography>
          ) : (
            paymentMethodKeys.map((paymentMethod) => (
              <Box key={paymentMethod} sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                  {paymentMethod}
                </Typography>
                <TableContainer>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor ID</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Posting Date</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Project</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Closed</TableCell>
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Aging</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupedPurchaseInvoices[paymentMethod].map((invoice, index) => (
                        <TableRow 
                          key={index} 
                          hover
                          onContextMenu={(e) => handlePurchaseInvoiceContextMenu(e, invoice)}
                          sx={{ 
                            cursor: 'context-menu',
                            bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                            '&:hover': { bgcolor: 'action.selected' }
                          }}
                        >
                          <TableCell>{invoice.No || '-'}</TableCell>
                          <TableCell>{invoice.Buy_from_Vendor_No || '-'}</TableCell>
                          <TableCell>{invoice.Buy_from_Vendor_Name || '-'}</TableCell>
                          <TableCell>{formatDate(invoice.Posting_Date)}</TableCell>
                          <TableCell>{invoice.Project || '-'}</TableCell>
                          <TableCell>{invoice.Currency_Code || '-'}</TableCell>
                          <TableCell align="right">
                            {invoice.Amount ? formatCurrency(invoice.Amount, invoice.Currency_Code) : '-'}
                          </TableCell>
                          <TableCell>{invoice.Closed ? 'Yes' : 'No'}</TableCell>
                          <TableCell align="right">
                            {typeof calculateAging(invoice.Posting_Date) === 'number' 
                              ? `${calculateAging(invoice.Posting_Date)} days`
                              : calculateAging(invoice.Posting_Date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))
          )}
        </TabPanel>

        {/* Salary Tab */}
        <TabPanel value={activeTab} index={4}>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5 } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Period</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Location</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Payroll Amount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Aging</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salaryPayments.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No salary payments found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {salaryPayments.map((salary, index) => (
                  <TableRow 
                    key={index} 
                    hover
                    onContextMenu={(e) => handleSalaryContextMenu(e, salary)}
                    sx={{ 
                      cursor: 'context-menu',
                      bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                      '&:hover': { bgcolor: 'action.selected' }
                    }}
                  >
                    <TableCell>{salary.No || '-'}</TableCell>
                    <TableCell>{salary.Period || '-'}</TableCell>
                    <TableCell>{salary.Location || '-'}</TableCell>
                    <TableCell>{salary.Currency || '-'}</TableCell>
                    <TableCell align="right">
                      {salary.Payroll_Amount ? formatCurrency(salary.Payroll_Amount, salary.Currency) : '-'}
                    </TableCell>
                    <TableCell>{salary.Status || '-'}</TableCell>
                    <TableCell align="right">
                      {typeof calculateAging(salary.Period) === 'number' 
                        ? `${calculateAging(salary.Period)} days`
                        : calculateAging(salary.Period)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Context Menu for Personnel */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handlePayClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pay</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSeeTransactionClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>See Transaction</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShowVendorClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show Vendor</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleBankAccountClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bank Account</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (contextMenu?.expense) {
              // Get all the values from the expense object
              const expenseValues = Object.values(contextMenu.expense);
              // The fourth column (index 3) contains the folder URL
              const folderUrl = expenseValues[3];
              if (folderUrl && typeof folderUrl === 'string' && folderUrl.trim() !== '') {
                handleFolderClick(folderUrl);
              }
            }
            handleCloseContextMenu();
          }}
          disabled={(() => {
            if (!contextMenu?.expense) return true;
            const expenseValues = Object.values(contextMenu.expense);
            const folderUrl = expenseValues[3]; // Folder is at index 3
            return !folderUrl || typeof folderUrl !== 'string' || folderUrl.trim() === '';
          })()}
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open Folder</ListItemText>
        </MenuItem>
      </Menu>

      {/* Context Menu for Prepayments */}
      <Menu
        open={prepaymentContextMenu !== null}
        onClose={handleClosePrepaymentContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          prepaymentContextMenu !== null
            ? { top: prepaymentContextMenu.mouseY, left: prepaymentContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handlePrepaymentPayClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pay</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrepaymentShowVendorClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show Vendor</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrepaymentBankAccountClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bank Account</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrepaymentSeeTransactionClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>See Transaction</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={handlePrepaymentOpenFolderClick}
          disabled={!prepaymentContextMenu?.prepayment?.Folder || prepaymentContextMenu.prepayment.Folder.trim() === ''}
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open Folder</ListItemText>
        </MenuItem>
      </Menu>

      {/* Context Menu for Purchase Invoices */}
      <Menu
        open={purchaseInvoiceContextMenu !== null}
        onClose={handleClosePurchaseInvoiceContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          purchaseInvoiceContextMenu !== null
            ? { top: purchaseInvoiceContextMenu.mouseY, left: purchaseInvoiceContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handlePurchaseInvoicePayClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pay</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePurchaseInvoiceShowVendorClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show Vendor</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePurchaseInvoiceBankAccountClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bank Account</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePurchaseInvoiceSeeTransactionClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>See Transaction</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={handlePurchaseInvoiceOpenFolderClick}
          disabled={!purchaseInvoiceContextMenu?.invoice?.Folder_Link || purchaseInvoiceContextMenu.invoice.Folder_Link.trim() === ''}
        >
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open Folder</ListItemText>
        </MenuItem>
      </Menu>

      {/* Context Menu for Salary */}
      <Menu
        open={salaryContextMenu !== null}
        onClose={handleCloseSalaryContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          salaryContextMenu !== null
            ? { top: salaryContextMenu.mouseY, left: salaryContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleSalaryPayClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pay</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSalaryShowTransactionClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show Transaction</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSalaryOpenFolderClick}>
          <ListItemIcon>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open Folder</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
