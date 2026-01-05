/**
 * Payment Service
 * Handles fetching payment-related data from Business Central via backend API proxy
 */

import api from './api';
import type { PersonnelExpense, Prepayment, PurchaseInvoice, SalaryPayment } from '../types/payments';

/**
 * Fetch personnel expenses
 * @param showAll - If true, fetch all records ignoring filters
 */
export async function getPersonnelExpenses(showAll: boolean = false): Promise<PersonnelExpense[]> {
  try {
    const response = await api.get('/bc/personnel-expenses', {
      params: { showAll }
    });
    return response.data.expenses || [];
  } catch (error) {
    console.error('Error fetching personnel expenses:', error);
    throw error;
  }
}

/**
 * Fetch prepayments (unpaid only, with payment date)
 */
export async function getPrepayments(showAll: boolean = false): Promise<Prepayment[]> {
  try {
    const params = new URLSearchParams();
    if (showAll) {
      params.append('showAll', 'true');
    }
    const response = await api.get(`/bc/prepayments?${params.toString()}`);
    return response.data.prepayments || [];
  } catch (error) {
    console.error('Error fetching prepayments:', error);
    throw error;
  }
}

/**
 * Fetch purchase invoices
 */
export async function getPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  try {
    const response = await api.get('/bc/purchase-invoices');
    return response.data.invoices || [];
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    throw error;
  }
}

/**
 * Fetch salary payments
 */
export async function getSalaryPayments(): Promise<SalaryPayment[]> {
  try {
    const response = await api.get('/bc/salary-payments');
    return response.data.salaries || [];
  } catch (error) {
    console.error('Error fetching salary payments:', error);
    throw error;
  }
}

/**
 * Fetch vendors for vendor ID lookup
 */
export async function getVendors(): Promise<{ number: string; name: string }[]> {
  try {
    const response = await api.get('/bc/vendors');
    return response.data.vendors || [];
  } catch (error) {
    console.error('Error fetching vendors:', error);
    throw error;
  }
}

/**
 * Bank account type from BC API
 */
export interface BankAccount {
  No: string;
  Name: string;
  Currency_Code: string;
}

/**
 * Fetch bank accounts for payment journal
 */
export async function getBankAccounts(): Promise<BankAccount[]> {
  try {
    const response = await api.get('/bc/bank-accounts');
    return response.data.bankAccounts || [];
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    throw error;
  }
}

/**
 * Generic payment data for creating journal lines
 */
export interface PaymentData {
  vendorNo: string;
  vendorName: string;
  amount: number;
  documentNo: string;
  invoiceReference: string; // External Document No / Reference
  bankAccountNo: string;
  paymentReference: string; // Document No.
  bankCurrencyCode: string;
}

/**
 * Create a payment journal line in Business Central
 * Creates TWO lines: one for Vendor (debit), one for Bank Account (credit)
 * @param paymentData - The payment data
 * @returns Object with success status, message, and URL to open payment journal
 */
export async function createPaymentJournalLineGeneric(
  paymentData: PaymentData
): Promise<{
  success: boolean;
  message: string;
  lineId?: string;
  paymentUrl?: string;
  error?: string;
}> {
  try {
    const response = await api.post('/bc/payment-journal-line', paymentData);
    return response.data;
  } catch (error: any) {
    console.error('Error creating payment journal line:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to create payment journal line',
      error: error.response?.data?.details || error.message
    };
  }
}

/**
 * Create a payment journal line in Business Central for Purchase Invoice
 * Creates TWO lines: one for Vendor (debit), one for Bank Account (credit)
 * @param invoice - The purchase invoice to create payment for
 * @param bankAccountNo - The bank account number for the credit line
 * @param paymentReference - The payment reference (Document No.)
 * @param bankCurrencyCode - The currency code of the selected bank account
 * @returns Object with success status, message, and URL to open payment journal
 */
export async function createPaymentJournalLine(
  invoice: PurchaseInvoice,
  bankAccountNo: string,
  paymentReference: string,
  bankCurrencyCode: string
): Promise<{
  success: boolean;
  message: string;
  lineId?: string;
  paymentUrl?: string;
  error?: string;
}> {
  return createPaymentJournalLineGeneric({
    vendorNo: invoice.Buy_from_Vendor_No,
    vendorName: invoice.Buy_from_Vendor_Name,
    amount: invoice.Amount,
    documentNo: invoice.No,
    invoiceReference: invoice.External_Document_No || '',
    bankAccountNo,
    paymentReference,
    bankCurrencyCode
  });
}

/**
 * Create a payment journal line for Personnel Expense
 */
export async function createPersonnelPaymentJournalLine(
  expense: PersonnelExpense,
  bankAccountNo: string,
  paymentReference: string,
  bankCurrencyCode: string
): Promise<{
  success: boolean;
  message: string;
  lineId?: string;
  paymentUrl?: string;
  error?: string;
}> {
  return createPaymentJournalLineGeneric({
    vendorNo: expense.Vendor,
    vendorName: expense.Vendor_Name,
    amount: expense.Amount,
    documentNo: expense.No,
    invoiceReference: expense.Invoice_Number || expense.Payment_Reference || '', // Use Invoice_Number as External Document No
    bankAccountNo,
    paymentReference,
    bankCurrencyCode
  });
}

/**
 * Create a payment journal line for Prepayment
 */
export async function createPrepaymentJournalLine(
  prepayment: Prepayment,
  vendorNo: string, // Need to pass vendor No since Prepayment only has Vendor_Name
  bankAccountNo: string,
  paymentReference: string,
  bankCurrencyCode: string
): Promise<{
  success: boolean;
  message: string;
  lineId?: string;
  paymentUrl?: string;
  error?: string;
}> {
  return createPaymentJournalLineGeneric({
    vendorNo: vendorNo,
    vendorName: prepayment.Vendor_Name,
    amount: prepayment.Prepayment_Amount,
    documentNo: prepayment.No,
    invoiceReference: prepayment.Payment_Reference || '', // Use Payment_Reference as External Document No
    bankAccountNo,
    paymentReference,
    bankCurrencyCode
  });
}

/**
 * Vendor card type from BC API (Vendor_Card_Excel)
 */
export interface VendorCard {
  No: string;
  Name: string;
  Currency_Code: string;
}

/**
 * Fetch vendor cards (full list) for employee selection
 */
export async function getVendorCards(): Promise<VendorCard[]> {
  try {
    const response = await api.get('/bc/vendor-cards');
    return response.data.vendors || [];
  } catch (error) {
    console.error('Error fetching vendor cards:', error);
    throw error;
  }
}

/**
 * Employee entry for salary payment
 */
export interface SalaryEmployee {
  vendorNo: string;
  vendorName: string;
  paymentReference: string;
  amount: number;
}

/**
 * Create payment journal lines for salary payments (multiple employees)
 */
export async function createSalaryPaymentJournalLines(
  bankAccountNo: string,
  bankCurrencyCode: string,
  payrollMonth: string, // Format: MM/YYYY
  employees: SalaryEmployee[]
): Promise<{
  success: boolean;
  message: string;
  results?: any[];
  errors?: any[];
  paymentUrl?: string;
}> {
  try {
    const response = await api.post('/bc/salary-payment-journal-lines', {
      bankAccountNo,
      bankCurrencyCode,
      payrollMonth,
      employees
    });
    return response.data;
  } catch (error: any) {
    console.error('Error creating salary payment journal lines:', error);
    return {
      success: false,
      message: error.response?.data?.error || 'Failed to create salary payment journal lines',
    };
  }
}
