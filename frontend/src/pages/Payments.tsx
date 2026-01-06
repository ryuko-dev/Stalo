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
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  Divider,
} from '@mui/material';
import { 
  Folder as FolderIcon, 
  Refresh as RefreshIcon, 
  Search as SearchIcon,
  Payment as PaymentIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { getPersonnelExpenses, getPrepayments, getPurchaseInvoices, getSalaryPayments, getVendors, createPaymentJournalLine, createPersonnelPaymentJournalLine, createPrepaymentJournalLine, createReceivablesJournalLine, getBankAccounts, getVendorCards, createSalaryPaymentJournalLines, type BankAccount, type VendorCard, type SalaryEmployee } from '../services/paymentService';
import { convertToUSD } from '../services/exchangeRateService';
import type { PersonnelExpense, Prepayment, PurchaseInvoice, SalaryPayment } from '../types/payments';
import { getPostedSalesInvoices } from '../services/staloService';

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
  
  const [receivablesContextMenu, setReceivablesContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    invoice: any | null;
  } | null>(null);

  // Snackbar state for payment journal feedback
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [creatingPayment, setCreatingPayment] = useState(false);

  // Payment dialog state - supports Purchase Invoice, Personnel, and Prepayment
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogInvoice, setPaymentDialogInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentDialogPersonnel, setPaymentDialogPersonnel] = useState<PersonnelExpense | null>(null);
  const [paymentDialogPrepayment, setPaymentDialogPrepayment] = useState<Prepayment | null>(null);
  const [paymentDialogReceivable, setPaymentDialogReceivable] = useState<any | null>(null);
  const [paymentDialogType, setPaymentDialogType] = useState<'invoice' | 'personnel' | 'prepayment' | 'receivables'>('invoice');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);

  // Salary Payment Dialog state
  const [salaryPaymentDialogOpen, setSalaryPaymentDialogOpen] = useState(false);
  const [vendorCards, setVendorCards] = useState<VendorCard[]>([]);
  const [loadingVendorCards, setLoadingVendorCards] = useState(false);
  const [salaryPayrollMonth, setSalaryPayrollMonth] = useState<string>('');
  const [salaryEmployees, setSalaryEmployees] = useState<SalaryEmployee[]>([]);
  const [selectedVendorCard, setSelectedVendorCard] = useState<VendorCard | null>(null);
  const [newEmployeePaymentRef, setNewEmployeePaymentRef] = useState<string>('');
  const [newEmployeeAmount, setNewEmployeeAmount] = useState<string>('');

  // Data states
  const [personnelExpenses, setPersonnelExpenses] = useState<PersonnelExpense[]>([]);
  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [postedSalesInvoices, setPostedSalesInvoices] = useState<any[]>([]);
  const [vendorLookup, setVendorLookup] = useState<Map<string, string>>(new Map());
  const [usdAmounts, setUsdAmounts] = useState<{ [currency: string]: number }>({});
  const [receivablesUsdAmounts, setReceivablesUsdAmounts] = useState<{ [currency: string]: number }>({});

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
      const [personnel, prepaid, purchase, salary, salesInvoices, vendors] = await Promise.all([
        getPersonnelExpenses(false), // Always fetch all
        getPrepayments(true), // Always fetch all prepayments, filter on frontend
        getPurchaseInvoices(),
        getSalaryPayments(),
        getPostedSalesInvoices({ $top: 500 }),
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
      
      // Set posted sales invoices
      setPostedSalesInvoices(salesInvoices.invoices || []);
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

  const handlePayClick = async () => {
    const expense = contextMenu?.expense;
    if (!expense) {
      handleCloseContextMenu();
      return;
    }

    // Open payment dialog
    setPaymentDialogType('personnel');
    setPaymentDialogPersonnel(expense);
    setPaymentDialogInvoice(null);
    setPaymentDialogPrepayment(null);
    setSelectedBankAccount('');
    setPaymentReference('');
    setPaymentDialogOpen(true);
    handleCloseContextMenu();

    // Load bank accounts if not already loaded
    if (bankAccounts.length === 0) {
      setLoadingBankAccounts(true);
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error loading bank accounts:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load bank accounts',
          severity: 'error'
        });
      } finally {
        setLoadingBankAccounts(false);
      }
    }
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

  const handlePrepaymentPayClick = async () => {
    const prepayment = prepaymentContextMenu?.prepayment;
    if (!prepayment) {
      handleClosePrepaymentContextMenu();
      return;
    }

    // Open payment dialog
    setPaymentDialogType('prepayment');
    setPaymentDialogPrepayment(prepayment);
    setPaymentDialogInvoice(null);
    setPaymentDialogPersonnel(null);
    setSelectedBankAccount('');
    setPaymentReference('');
    setPaymentDialogOpen(true);
    handleClosePrepaymentContextMenu();

    // Load bank accounts if not already loaded
    if (bankAccounts.length === 0) {
      setLoadingBankAccounts(true);
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error loading bank accounts:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load bank accounts',
          severity: 'error'
        });
      } finally {
        setLoadingBankAccounts(false);
      }
    }
  };

  const handleReceivablesPayClick = async () => {
    const invoice = receivablesContextMenu?.invoice;
    if (!invoice) {
      handleCloseReceivablesContextMenu();
      return;
    }

    // Open payment dialog
    setPaymentDialogType('receivables');
    setPaymentDialogReceivable(invoice);
    setPaymentDialogInvoice(null);
    setPaymentDialogPersonnel(null);
    setPaymentDialogPrepayment(null);
    setSelectedBankAccount('');
    setPaymentReference('');
    setPaymentDialogOpen(true);
    handleCloseReceivablesContextMenu();

    // Load bank accounts if not already loaded
    if (bankAccounts.length === 0) {
      setLoadingBankAccounts(true);
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error loading bank accounts:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load bank accounts',
          severity: 'error'
        });
      } finally {
        setLoadingBankAccounts(false);
      }
    }
  };

  const handleCloseReceivablesContextMenu = () => {
    setReceivablesContextMenu(null);
  };

  const handleReceivablesShowCustomerClick = () => {
    if (receivablesContextMenu?.invoice) {
      const invoice = receivablesContextMenu.invoice;
      const customerNo = invoice.Sell_to_Customer_No;
      if (customerNo) {
        const customerUrl = `https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production/?company=ARK%20Group%20Live&page=25&filter=%27Cust.%20Ledger%20Entry%27.%27Customer%20No.%27%20IS%20%27${customerNo}%27&dc=0`;
        window.open(customerUrl, '_blank');
      }
    }
    handleCloseReceivablesContextMenu();
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

  const handlePurchaseInvoicePayClick = async () => {
    const invoice = purchaseInvoiceContextMenu?.invoice;
    if (!invoice) {
      handleClosePurchaseInvoiceContextMenu();
      return;
    }

    // Open payment dialog instead of directly creating
    setPaymentDialogType('invoice');
    setPaymentDialogInvoice(invoice);
    setPaymentDialogPersonnel(null);
    setPaymentDialogPrepayment(null);
    setSelectedBankAccount('');
    setPaymentReference('');
    setPaymentDialogOpen(true);
    handleClosePurchaseInvoiceContextMenu();

    // Load bank accounts if not already loaded
    if (bankAccounts.length === 0) {
      setLoadingBankAccounts(true);
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error loading bank accounts:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load bank accounts',
          severity: 'error'
        });
      } finally {
        setLoadingBankAccounts(false);
      }
    }
  };

  const handlePaymentDialogClose = () => {
    setPaymentDialogOpen(false);
    setPaymentDialogInvoice(null);
    setPaymentDialogPersonnel(null);
    setPaymentDialogPrepayment(null);
    setSelectedBankAccount('');
    setPaymentReference('');
  };

  const handlePaymentDialogSubmit = async () => {
    if (!selectedBankAccount) {
      setSnackbar({
        open: true,
        message: 'Please select a bank account',
        severity: 'error'
      });
      return;
    }

    const selectedBank = bankAccounts.find(b => b.No === selectedBankAccount);
    if (!selectedBank) {
      setSnackbar({
        open: true,
        message: 'Invalid bank account selected',
        severity: 'error'
      });
      return;
    }

    setPaymentDialogOpen(false);
    setCreatingPayment(true);

    try {
      let result;
      let vendorName = '';

      if (paymentDialogType === 'invoice' && paymentDialogInvoice) {
        // Create payment journal line for Purchase Invoice
        result = await createPaymentJournalLine(
          paymentDialogInvoice,
          selectedBankAccount,
          paymentReference,
          selectedBank.Currency_Code
        );
        vendorName = paymentDialogInvoice.Buy_from_Vendor_Name;
      } else if (paymentDialogType === 'personnel' && paymentDialogPersonnel) {
        // Create payment journal line for Personnel Expense
        result = await createPersonnelPaymentJournalLine(
          paymentDialogPersonnel,
          selectedBankAccount,
          paymentReference,
          selectedBank.Currency_Code
        );
        vendorName = paymentDialogPersonnel.Vendor_Name;
      } else if (paymentDialogType === 'prepayment' && paymentDialogPrepayment) {
        // Create payment journal line for Prepayment
        // Need to look up vendor ID from vendor name
        const vendorNo = vendorLookup.get(paymentDialogPrepayment.Vendor_Name?.trim() || '') || '';
        result = await createPrepaymentJournalLine(
          paymentDialogPrepayment,
          vendorNo,
          selectedBankAccount,
          paymentReference,
          selectedBank.Currency_Code
        );
        vendorName = paymentDialogPrepayment.Vendor_Name;
      } else if (paymentDialogType === 'receivables' && paymentDialogReceivable) {
        // Create payment journal line for Receivables (customer payment)
        result = await createReceivablesJournalLine(
          paymentDialogReceivable,
          selectedBankAccount,
          paymentReference,
          selectedBank.Currency_Code
        );
        vendorName = paymentDialogReceivable.Sell_to_Customer_Name;
      } else {
        setSnackbar({
          open: true,
          message: 'No payment data selected',
          severity: 'error'
        });
        return;
      }
      
      if (result.success) {
        setSnackbar({
          open: true,
          message: `Payment journal lines created for ${vendorName}`,
          severity: 'success'
        });
        
        // Open the payment journal in BC
        if (result.paymentUrl) {
          window.open(result.paymentUrl, '_blank');
        }
      } else {
        setSnackbar({
          open: true,
          message: result.message || 'Failed to create payment journal line',
          severity: 'error'
        });
        
        // Fallback: open General Journal
        const paymentUrl = 'https://businesscentral.dynamics.com/9f4e2976-b07e-4f8f-9c78-055f6c855a11/Production?company=ARK%20Group%20Live&page=39&filter=%27Gen.%20Journal%20Line%27.%27Journal%20Template%20Name%27%20IS%20%27GENERAL%27%20AND%20%27Gen.%20Journal%20Line%27.%27Journal%20Batch%20Name%27%20IS%20%27PAYMENT%27&dc=0';
        window.open(paymentUrl, '_blank');
      }
    } catch (err) {
      console.error('Error creating payment journal line:', err);
      setSnackbar({
        open: true,
        message: 'Error creating payment journal line',
        severity: 'error'
      });
    } finally {
      setCreatingPayment(false);
      setPaymentDialogInvoice(null);
      setPaymentDialogPersonnel(null);
      setPaymentDialogPrepayment(null);
      setPaymentDialogReceivable(null);
      setSelectedBankAccount('');
      setPaymentReference('');
    }
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

  const handleSalaryPayClick = async () => {
    handleCloseSalaryContextMenu();
    
    // Open salary payment dialog
    setSalaryPaymentDialogOpen(true);
    setSelectedBankAccount('');
    setSalaryPayrollMonth('');
    setSalaryEmployees([]);
    setSelectedVendorCard(null);
    setNewEmployeePaymentRef('');
    setNewEmployeeAmount('');

    // Load bank accounts if not already loaded
    if (bankAccounts.length === 0) {
      setLoadingBankAccounts(true);
      try {
        const accounts = await getBankAccounts();
        setBankAccounts(accounts);
      } catch (err) {
        console.error('Error loading bank accounts:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load bank accounts',
          severity: 'error'
        });
      } finally {
        setLoadingBankAccounts(false);
      }
    }

    // Load vendor cards if not already loaded
    if (vendorCards.length === 0) {
      setLoadingVendorCards(true);
      try {
        const cards = await getVendorCards();
        setVendorCards(cards);
      } catch (err) {
        console.error('Error loading vendor cards:', err);
        setSnackbar({
          open: true,
          message: 'Failed to load vendor list',
          severity: 'error'
        });
      } finally {
        setLoadingVendorCards(false);
      }
    }
  };

  const handleSalaryPaymentDialogClose = () => {
    setSalaryPaymentDialogOpen(false);
    setSalaryPayrollMonth('');
    setSalaryEmployees([]);
    setSelectedVendorCard(null);
    setNewEmployeePaymentRef('');
    setNewEmployeeAmount('');
    setSelectedBankAccount('');
  };

  const handleAddEmployee = () => {
    if (!selectedVendorCard || !newEmployeeAmount || parseFloat(newEmployeeAmount) <= 0) {
      setSnackbar({
        open: true,
        message: 'Please select an employee and enter a valid amount',
        severity: 'error'
      });
      return;
    }

    // Check if employee already added
    if (salaryEmployees.some(e => e.vendorNo === selectedVendorCard.No)) {
      setSnackbar({
        open: true,
        message: 'This employee has already been added',
        severity: 'error'
      });
      return;
    }

    const newEmployee: SalaryEmployee = {
      vendorNo: selectedVendorCard.No,
      vendorName: selectedVendorCard.Name,
      paymentReference: newEmployeePaymentRef,
      amount: parseFloat(newEmployeeAmount)
    };

    setSalaryEmployees([...salaryEmployees, newEmployee]);
    setSelectedVendorCard(null);
    setNewEmployeePaymentRef('');
    setNewEmployeeAmount('');
  };

  const handleRemoveEmployee = (vendorNo: string) => {
    setSalaryEmployees(salaryEmployees.filter(e => e.vendorNo !== vendorNo));
  };

  const handleSalaryPaymentSubmit = async () => {
    if (!selectedBankAccount) {
      setSnackbar({
        open: true,
        message: 'Please select a bank account',
        severity: 'error'
      });
      return;
    }

    if (!salaryPayrollMonth) {
      setSnackbar({
        open: true,
        message: 'Please enter the payroll month',
        severity: 'error'
      });
      return;
    }

    if (salaryEmployees.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please add at least one employee',
        severity: 'error'
      });
      return;
    }

    const selectedBank = bankAccounts.find(b => b.No === selectedBankAccount);
    if (!selectedBank) {
      setSnackbar({
        open: true,
        message: 'Invalid bank account selected',
        severity: 'error'
      });
      return;
    }

    setSalaryPaymentDialogOpen(false);
    setCreatingPayment(true);

    try {
      const result = await createSalaryPaymentJournalLines(
        selectedBankAccount,
        selectedBank.Currency_Code,
        salaryPayrollMonth,
        salaryEmployees
      );

      if (result.success) {
        setSnackbar({
          open: true,
          message: result.message || `Payment journal lines created for ${salaryEmployees.length} employees`,
          severity: 'success'
        });
        
        if (result.paymentUrl) {
          window.open(result.paymentUrl, '_blank');
        }
      } else {
        setSnackbar({
          open: true,
          message: result.message || 'Failed to create payment journal lines',
          severity: 'error'
        });
      }
    } catch (err) {
      console.error('Error creating salary payment journal lines:', err);
      setSnackbar({
        open: true,
        message: 'Error creating payment journal lines',
        severity: 'error'
      });
    } finally {
      setCreatingPayment(false);
      setSalaryPayrollMonth('');
      setSalaryEmployees([]);
      setSelectedBankAccount('');
    }
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

  // Calculate receivables summary by currency
  const getReceivablesSummaryData = () => {
    const summary: { [customerName: string]: { [currency: string]: number } } = {};
    
    // Add open sales invoices grouped by customer
    postedSalesInvoices
      .filter(invoice => !invoice.Closed)
      .forEach(invoice => {
        const customerName = invoice.Sell_to_Customer_Name || 'Unknown Customer';
        const currency = invoice.Currency_Code || 'N/A';
        
        if (!summary[customerName]) summary[customerName] = {};
        if (!summary[customerName][currency]) summary[customerName][currency] = 0;
        summary[customerName][currency] += invoice.Remaining_Amount || 0;
      });

    return summary;
  };

  // Convert summary totals to USD
  useEffect(() => {
    const calculateUSDAmounts = async () => {
      // Calculate payables USD amounts
      const summary = getSummaryData();
      const usdConversions: { [currency: string]: number } = {};
      
      for (const [currency, categories] of Object.entries(summary)) {
        const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
        usdConversions[currency] = await convertToUSD(total, currency);
      }
      
      setUsdAmounts(usdConversions);
      
      // Calculate receivables USD amounts
      const receivablesSummary = getReceivablesSummaryData();
      const receivablesUsdConversions: { [customerName: string]: number } = {};
      
      for (const [customerName, currencies] of Object.entries(receivablesSummary)) {
        receivablesUsdConversions[customerName] = 0;
        for (const [currency, amount] of Object.entries(currencies)) {
          receivablesUsdConversions[customerName] += await convertToUSD(amount, currency);
        }
      }
      
      setReceivablesUsdAmounts(receivablesUsdConversions);
    };
    
    if (!loading) {
      calculateUSDAmounts();
    }
  }, [personnelExpenses, prepayments, purchaseInvoices, salaryPayments, postedSalesInvoices, loading]);

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
          <Tab label={`Receivables (${postedSalesInvoices.filter(invoice => !invoice.Closed).length})`} />
        </Tabs>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Summary Tab */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>
            Payables Summary
          </Typography>
          <TableContainer component={Paper} sx={{ boxShadow: 2, mb: 4 }}>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Category</TableCell>
                  {(() => {
                    const currencies = Object.keys(getSummaryData());
                    return currencies.map(currency => (
                      <TableCell key={currency} align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                        {currency}
                      </TableCell>
                    ));
                  })()}
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Total USD</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const summary = getSummaryData();
                  const categories = ['Personnel', 'Prepayments', 'Purchase Invoices', 'Salary'];
                  const currencies = Object.keys(summary);
                  
                  if (currencies.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No pending payments
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return (
                    <>
                      {categories.map((category, catIndex) => {
                        // Calculate USD total for this category across all currencies
                        let categoryUsdTotal = 0;
                        currencies.forEach(currency => {
                          const amount = summary[currency][category] || 0;
                          if (amount > 0 && usdAmounts[currency]) {
                            // Calculate what portion of this currency's USD amount belongs to this category
                            const currencyTotal = Object.values(summary[currency]).reduce((sum, val) => sum + val, 0);
                            const proportion = amount / currencyTotal;
                            categoryUsdTotal += usdAmounts[currency] * proportion;
                          }
                        });
                        
                        return (
                          <TableRow 
                            key={category}
                            sx={{ 
                              bgcolor: catIndex % 2 === 0 ? 'action.hover' : 'transparent',
                              '&:hover': { bgcolor: 'action.selected' }
                            }}
                          >
                            <TableCell sx={{ fontWeight: 'bold' }}>{category}</TableCell>
                            {currencies.map(currency => {
                              const amount = summary[currency][category] || 0;
                              return (
                                <TableCell key={currency} align="right">
                                  {formatCurrency(amount, currency)}
                                </TableCell>
                              );
                            })}
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              {formatCurrency(categoryUsdTotal, 'USD')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: 'action.selected', borderTop: 2, borderColor: 'primary.main' }}>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                          Total
                        </TableCell>
                        {currencies.map(currency => {
                          const total = Object.values(summary[currency]).reduce((sum, val) => sum + val, 0);
                          return (
                            <TableCell key={currency} align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                              {formatCurrency(total, currency)}
                            </TableCell>
                          );
                        })}
                        <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'primary.main' }}>
                          {formatCurrency(
                            Object.values(usdAmounts).reduce((sum, val) => sum + val, 0),
                            'USD'
                          )}
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })()}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Receivables Summary */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'success.main' }}>
              Receivables Summary by Customer
            </Typography>
            <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
              <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'success.main' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer</TableCell>
                    {(() => {
                      const receivablesSummary = getReceivablesSummaryData();
                      // Get all unique currencies across all customers
                      const currenciesSet = new Set<string>();
                      Object.values(receivablesSummary).forEach(customerData => {
                        Object.keys(customerData).forEach(currency => currenciesSet.add(currency));
                      });
                      const currencies = Array.from(currenciesSet).sort();
                      
                      return currencies.map(currency => (
                        <TableCell key={currency} align="right" sx={{ color: 'white', fontWeight: 'bold' }}>
                          {currency}
                        </TableCell>
                      ));
                    })()}
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Total USD</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const receivablesSummary = getReceivablesSummaryData();
                    const customerNames = Object.keys(receivablesSummary).sort();
                    
                    if (customerNames.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={2} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No open receivables
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    // Get all unique currencies
                    const currenciesSet = new Set<string>();
                    Object.values(receivablesSummary).forEach(customerData => {
                      Object.keys(customerData).forEach(currency => currenciesSet.add(currency));
                    });
                    const currencies = Array.from(currenciesSet).sort();
                    
                    return (
                      <>
                        {customerNames.map((customerName, index) => {
                          const customerData = receivablesSummary[customerName];
                          
                          return (
                            <TableRow 
                              key={customerName}
                              sx={{ 
                                bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                                '&:hover': { bgcolor: 'action.selected' }
                              }}
                            >
                              <TableCell sx={{ fontWeight: 'bold' }}>{customerName}</TableCell>
                              {currencies.map(currency => {
                                const amount = customerData[currency] || 0;
                                return (
                                  <TableCell key={currency} align="right">
                                    {amount > 0 ? formatCurrency(amount, currency) : '-'}
                                  </TableCell>
                                );
                              })}
                              <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                {formatCurrency(receivablesUsdAmounts[customerName] || 0, 'USD')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow sx={{ bgcolor: 'action.selected', borderTop: 2, borderColor: 'success.main' }}>
                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                            Total
                          </TableCell>
                          {currencies.map(currency => {
                            const total = customerNames.reduce((sum, customerName) => {
                              return sum + (receivablesSummary[customerName][currency] || 0);
                            }, 0);
                            return (
                              <TableCell key={currency} align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {formatCurrency(total, currency)}
                              </TableCell>
                            );
                          })}
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'success.main' }}>
                            {formatCurrency(
                              Object.values(receivablesUsdAmounts).reduce((sum, val) => sum + val, 0),
                              'USD'
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        {/* Personnel Tab */}
        <TabPanel value={activeTab} index={1}>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor ID</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Reference</TableCell>
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
                    <TableCell colSpan={11} align="center">
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
                      <TableCell>{expense.Invoice_Number || '-'}</TableCell>
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
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
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
                  <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor ID</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Vendor Name</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Reference</TableCell>
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
                          <TableCell>{invoice.External_Document_No || '-'}</TableCell>
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
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
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

        {/* Receivables Tab */}
        <TabPanel value={activeTab} index={5}>
          <TableContainer>
            <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer No</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Customer Name</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Document Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Currency Code</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Amount</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Remaining Amount</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Aging (Days)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {postedSalesInvoices.filter(invoice => !invoice.Closed).length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No open sales invoices found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {postedSalesInvoices.filter(invoice => !invoice.Closed).map((invoice, index) => {
                  const documentDate = invoice.Document_Date ? new Date(invoice.Document_Date) : null;
                  const today = new Date();
                  const agingDays = documentDate ? Math.floor((today.getTime() - documentDate.getTime()) / (1000 * 60 * 60 * 24)) : '-';
                  
                  return (
                    <TableRow 
                      key={invoice.No || index} 
                      hover
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setReceivablesContextMenu(
                          receivablesContextMenu === null
                            ? { mouseX: e.clientX + 2, mouseY: e.clientY - 6, invoice }
                            : null
                        );
                      }}
                      sx={{ 
                        bgcolor: index % 2 === 0 ? 'action.hover' : 'transparent',
                        '&:hover': { bgcolor: 'action.selected' },
                        cursor: 'context-menu'
                      }}
                    >
                      <TableCell>{invoice.No || '-'}</TableCell>
                      <TableCell>{invoice.Sell_to_Customer_No || '-'}</TableCell>
                      <TableCell>{invoice.Sell_to_Customer_Name || '-'}</TableCell>
                      <TableCell>{invoice.Description || '-'}</TableCell>
                      <TableCell>{formatDate(invoice.Document_Date)}</TableCell>
                      <TableCell>{invoice.Currency_Code || '-'}</TableCell>
                      <TableCell align="right">
                        {invoice.Amount ? formatCurrency(invoice.Amount, invoice.Currency_Code) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {invoice.Remaining_Amount ? formatCurrency(invoice.Remaining_Amount, invoice.Currency_Code) : '-'}
                      </TableCell>
                      <TableCell align="right">{agingDays}</TableCell>
                    </TableRow>
                  );
                })}
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

      {/* Context Menu for Receivables */}
      <Menu
        open={receivablesContextMenu !== null}
        onClose={handleCloseReceivablesContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          receivablesContextMenu !== null
            ? { top: receivablesContextMenu.mouseY, left: receivablesContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleReceivablesPayClick}>
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Record Payment</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleReceivablesShowCustomerClick}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show Customer</ListItemText>
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

      {/* Snackbar for payment feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={handlePaymentDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create Payment Journal</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {/* Show different info based on payment type */}
            {paymentDialogType === 'invoice' && paymentDialogInvoice && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Vendor:</strong> {paymentDialogInvoice.Buy_from_Vendor_Name}<br />
                <strong>Invoice:</strong> {paymentDialogInvoice.No}<br />
                <strong>Reference:</strong> {paymentDialogInvoice.External_Document_No || '-'}<br />
                <strong>Amount:</strong> {paymentDialogInvoice.Currency_Code} {paymentDialogInvoice.Amount?.toLocaleString()}
              </Typography>
            )}
            {paymentDialogType === 'personnel' && paymentDialogPersonnel && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Vendor:</strong> {paymentDialogPersonnel.Vendor_Name}<br />
                <strong>Expense No:</strong> {paymentDialogPersonnel.No}<br />
                <strong>Reference:</strong> {paymentDialogPersonnel.Invoice_Number || '-'}<br />
                <strong>Amount:</strong> {paymentDialogPersonnel.Currency} {paymentDialogPersonnel.Amount?.toLocaleString()}
              </Typography>
            )}
            {paymentDialogType === 'prepayment' && paymentDialogPrepayment && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Vendor:</strong> {paymentDialogPrepayment.Vendor_Name}<br />
                <strong>Prepayment No:</strong> {paymentDialogPrepayment.No}<br />
                <strong>Reference:</strong> {paymentDialogPrepayment.Payment_Reference || '-'}<br />
                <strong>Amount:</strong> {paymentDialogPrepayment.Currency} {paymentDialogPrepayment.Prepayment_Amount?.toLocaleString()}
              </Typography>
            )}
            {paymentDialogType === 'receivables' && paymentDialogReceivable && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Customer:</strong> {paymentDialogReceivable.Sell_to_Customer_Name}<br />
                <strong>Invoice No:</strong> {paymentDialogReceivable.No}<br />
                <strong>Document Date:</strong> {paymentDialogReceivable.Document_Date || '-'}<br />
                <strong>Amount:</strong> {paymentDialogReceivable.Currency_Code} {paymentDialogReceivable.Remaining_Amount?.toLocaleString()}
              </Typography>
            )}
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="bank-account-label">Bank Account</InputLabel>
              <Select
                labelId="bank-account-label"
                value={selectedBankAccount}
                label="Bank Account"
                onChange={(e) => setSelectedBankAccount(e.target.value)}
                disabled={loadingBankAccounts}
              >
                {loadingBankAccounts ? (
                  <MenuItem disabled>Loading bank accounts...</MenuItem>
                ) : (
                  bankAccounts.map((bank) => (
                    <MenuItem key={bank.No} value={bank.No}>
                      {bank.Name} {bank.Currency_Code ? `(${bank.Currency_Code})` : ''}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Payment Reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Enter payment reference (Document No.)"
              helperText="This will be used as Document No. in the journal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePaymentDialogClose}>Cancel</Button>
          <Button 
            onClick={handlePaymentDialogSubmit} 
            variant="contained" 
            disabled={!selectedBankAccount || loadingBankAccounts}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary Payment Dialog */}
      <Dialog open={salaryPaymentDialogOpen} onClose={handleSalaryPaymentDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Salary Payment Journal</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {/* Bank Account Selection */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="salary-bank-account-label">Bank Account</InputLabel>
              <Select
                labelId="salary-bank-account-label"
                value={selectedBankAccount}
                label="Bank Account"
                onChange={(e) => setSelectedBankAccount(e.target.value)}
                disabled={loadingBankAccounts}
              >
                {loadingBankAccounts ? (
                  <MenuItem disabled>Loading bank accounts...</MenuItem>
                ) : (
                  bankAccounts.map((bank) => (
                    <MenuItem key={bank.No} value={bank.No}>
                      {bank.Name} {bank.Currency_Code ? `(${bank.Currency_Code})` : ''}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Payroll Month Selection */}
            <TextField
              fullWidth
              label="Payroll Month"
              value={salaryPayrollMonth}
              onChange={(e) => setSalaryPayrollMonth(e.target.value)}
              placeholder="MM/YYYY (e.g., 01/2026)"
              helperText="This will be used as External Document No. (Vendor Invoice Ref)"
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 2 }} />

            {/* Employee Selection Section */}
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
              Add Employees
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <Autocomplete
                sx={{ flex: 2 }}
                options={vendorCards}
                getOptionLabel={(option) => `${option.No} - ${option.Name}`}
                value={selectedVendorCard}
                onChange={(_, newValue) => setSelectedVendorCard(newValue)}
                loading={loadingVendorCards}
                filterOptions={(options, { inputValue }) => {
                  const filterValue = inputValue.toLowerCase();
                  return options.filter(
                    option =>
                      option.No.toLowerCase().includes(filterValue) ||
                      option.Name.toLowerCase().includes(filterValue)
                  ).slice(0, 50); // Limit to 50 results for performance
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Employee (Vendor)"
                    placeholder="Search by ID or name..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingVendorCards ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <li key={key} {...otherProps}>
                      <Box>
                        <Typography variant="body2">{option.No} - {option.Name}</Typography>
                        {option.Currency_Code && (
                          <Typography variant="caption" color="text.secondary">
                            Currency: {option.Currency_Code}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  );
                }}
              />
              <TextField
                sx={{ flex: 1 }}
                label="Payment Reference"
                value={newEmployeePaymentRef}
                onChange={(e) => setNewEmployeePaymentRef(e.target.value)}
                placeholder="Document No."
                size="medium"
              />
              <TextField
                sx={{ flex: 1 }}
                label="Amount"
                type="number"
                value={newEmployeeAmount}
                onChange={(e) => setNewEmployeeAmount(e.target.value)}
                placeholder="0.00"
                size="medium"
                InputProps={{
                  inputProps: { min: 0, step: 0.01 }
                }}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddEmployee}
                disabled={!selectedVendorCard || !newEmployeeAmount}
                sx={{ height: 56 }}
              >
                Add
              </Button>
            </Box>

            {/* Added Employees List */}
            {salaryEmployees.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Employees to Pay ({salaryEmployees.length})
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell>Vendor ID</TableCell>
                        <TableCell>Employee Name</TableCell>
                        <TableCell>Payment Ref</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salaryEmployees.map((employee) => (
                        <TableRow key={employee.vendorNo}>
                          <TableCell>{employee.vendorNo}</TableCell>
                          <TableCell>{employee.vendorName}</TableCell>
                          <TableCell>{employee.paymentReference || '-'}</TableCell>
                          <TableCell align="right">{employee.amount.toLocaleString()}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveEmployee(employee.vendorNo)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.selected' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                          Total:
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {salaryEmployees.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSalaryPaymentDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSalaryPaymentSubmit} 
            variant="contained" 
            disabled={!selectedBankAccount || !salaryPayrollMonth || salaryEmployees.length === 0}
          >
            Submit ({salaryEmployees.length} employees)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading overlay when creating payment */}
      {creatingPayment && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Creating payment journal line...</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
