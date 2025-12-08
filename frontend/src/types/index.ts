export interface Project {
  ID: string;
  Name: string;
  StartDate: string;
  EndDate: string;
  ProjectCurrency?: string;
  ProjectBudget?: number;
  BudgetManager?: string;
  AllocationMode?: string;
  Fringe?: string;
}

export interface Position {
  ID: string;
  Project: string;
  TaskID: string;
  PositionName: string;
  MonthYear: string;
  AllocationMode: string;
  LoE: number;
  Allocated: string;
  ProjectName?: string;
}

export interface Resource {
  ID: string;
  Name: string;
  ResourceType: string;
  Entity: string;
  DynamicsVendorAcc: string;
  StartDate: string;
  EndDate: string | null;
  WorkDays: string;
  Department: string;
  EntityName?: string;
}

export interface Allocation {
  ID: string;
  ProjectID: string;
  ResourceID: string;
  PositionID: string;
  PositionName: string;
  ProjectName?: string;
  ResourceName?: string;
  MonthYear: string;
  AllocationMode: string;
  LoE: number;
}

export interface MonthlyAllocationSummary {
  Month: string;
  PositionId: string;
  PositionName: string;
  BudgetedAmount: number;
  AllocatedAmount: number;
  ResourceId: string | null;
  ResourceName: string | null;
}

export interface AllocationFormData {
  ProjectName: string;
  ResourceName: string;
  PositionName: string;
  MonthYear: string;
  AllocationMode: string;
  LoE: number;
}
