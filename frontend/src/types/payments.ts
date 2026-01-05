/**
 * Payment Types
 * Data structures for the Payments page
 */

export interface PersonnelExpense {
  No: string; // Related transaction number
  Vendor: string; // Vendor ID
  Vendor_Name: string;
  Type: string;
  Invoice_Number: string; // Reference (Invoice Number)
  Project: string;
  Currency: string;
  Amount: number;
  Paid: boolean;
  Folder: string; // Link to folder (capital F)
  Payment_Reference: string;
  Approver_One_Datetime: string;
  Approver_Two_Datetime: string; // Capital T in Two
  Approval_Requested_By_Datetime: string;
  Status: string;
  Journal_Reference: string;
  Bank_Account: string;
  Payment_Date: string;
}

export interface Prepayment {
  No: string; // Prepayment document number
  Vendor: string; // Vendor ID
  Vendor_Name: string;
  Type: string;
  Currency: string;
  Prepayment_Amount: number;
  Advance_Submission_Date: string; // Submission date
  Paid: boolean;
  Payment_Reference: string;
  Folder: string; // SharePoint folder URL (capital F)
  Bank_Account: string;
  Payment_Date: string;
  Approver_One_Datetime: string;
  Approver_Two_Datetime: string;
  Status: string;
  Payment_Method: string; // Payment method
}

export interface PurchaseInvoice {
  No: string; // Invoice number
  Buy_from_Vendor_No: string; // Vendor ID
  Buy_from_Vendor_Name: string; // Vendor name
  External_Document_No: string; // Reference (from Vendor Ledger Entries)
  Posting_Date: string; // Date posted
  Project: string; // Project code/name
  Currency_Code: string; // Currency
  Amount: number; // Invoice amount
  Closed: boolean; // Whether the invoice is closed
  Folder_Link: string; // SharePoint folder URL
  Payment_Method_Code: string; // Payment method code
}

export interface SalaryPayment {
  No: string; // Payroll number
  Period: string; // Payroll period
  Location: string; // Location
  Currency: string; // Currency code
  Payroll_Amount: number; // Payroll amount
  Status: string; // Status
}
