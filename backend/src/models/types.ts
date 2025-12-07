export interface Project {
  ID: string;
  Name: string;
  StartDate: Date;
  EndDate: Date;
  Status: string;
  Budget: number;
  Client: string;
  ProjectDirectoryId: string;
  BudgetManagerId: string;
  AllocationMode: string;
  CachedAt: Date;
  FixedAt: Date;
}

export interface Position {
  ID: string;
  ProjectId: string;
  Project: string;
  PositionName: string;
  MonthYear: Date;
  AllocationMode: string;
  Decimal: number;
}

export interface Resource {
  ID: string;
  Name: string;
  ResourceType: string;
  CostPerHour: number;
  DynamicVendorIds: string;
  RawData: string;
  EndDate: Date;
  HireDate: Date;
  Department: string;
}

export interface Allocation {
  ID: string;
  ResourceId: string;
  ProjectId: string;
  Department: string;
  PositionId: string;
  Password: string;
  Currency: string;
  Decimal: number;
  SocialSecurity: number;
  Income: number;
  EmployeeTax: number;
  Decimal2: number;
  Housing: number;
  CommunicationAllowance: number;
  Core: number;
  Date: Date;
  AnnualLeave: number;
  SickLeave: number;
  PublicHolidays: number;
  DailyRate: number;
  DisposalAllocation: number;
  Numeric: number;
}

export interface SystemUser {
  ID: string;
  Name: string;
  EmailAddress: string;
  StartDate: Date;
  EndDate: Date;
  Bit: boolean;
}

export interface Prefix {
  ID: string;
  Name: string;
  CurrencyCode: string;
  SizeCode: string;
  TaxRateCode: string;
}

export interface PayrollAllocation {
  ID: string;
  ResourceId: string;
  ProjectId: string;
  Department: string;
  PositionId: string;
  Currency: string;
  Decimal: number;
  SocialSecurity: number;
  Income: number;
  EmployeeTax: number;
  Decimal2: number;
  Housing: number;
  CommunicationAllowance: number;
  Core: number;
  Date: Date;
  MonthYear: number;
  AnnualLeave: number;
  SickLeave: number;
  PublicHolidays: number;
  DailyRate: number;
  DisposalAllocation: number;
  Numeric: number;
  FixedAt: Date;
}

export interface AllocationWithDetails extends Allocation {
  ResourceName?: string;
  ProjectName?: string;
  PositionName?: string;
}

export interface MonthlyAllocationSummary {
  month: string;
  totalBudgeted: number;
  totalAllocated: number;
  coverage: number;
  positions: PositionAllocationDetail[];
}

export interface PositionAllocationDetail {
  positionId: string;
  positionName: string;
  budgetedAmount: number;
  allocatedAmount: number;
  allocatedResources: {
    resourceId: string;
    resourceName: string;
    amount: number;
  }[];
}
