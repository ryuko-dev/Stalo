export type RoleType = 'Admin' | 'BudgetManager' | 'Viewer' | 'Editor' | 'SuperViewer';

export interface SystemUser {
  ID: string;
  Name: string;
  EmailAddress: string;
  StartDate: string | null;
  EndDate: string | null;
  Active: boolean | number | string; // DB might store bit or int or varchar
  Role: RoleType | string;
}

export interface SystemUserUpdate {
  Active?: boolean | number | string;
  Role?: RoleType | string;
}

export interface SystemUserCreate {
  Name: string;
  EmailAddress: string;
  StartDate?: string | null;
  EndDate?: string | null;
  Active?: boolean | number | string;
  Role?: RoleType | string;
}
