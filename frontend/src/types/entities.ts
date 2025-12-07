export interface Entity {
  ID: string;
  Name: string;
  CurrencyCode: string;
  SSAccCode: string;
  TaxAccCode: string;
}

export interface EntityCreate {
  Name: string;
  CurrencyCode?: string;
  SSAccCode?: string;
  TaxAccCode?: string;
}

export interface EntityUpdate {
  Name?: string;
  CurrencyCode?: string;
  SSAccCode?: string;
  TaxAccCode?: string;
}
