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
