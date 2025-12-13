export interface Entity {
  ID: string;
  Name: string;
  CurrencyCode: string;
  SSAccCode: string;
  TaxAccCode: string;
  SSExpCode?: string;
  TaxExpCode?: string;
  SalExpCode?: string;
}

export interface EntityCreate {
  Name: string;
  CurrencyCode?: string;
  SSAccCode?: string;
  TaxAccCode?: string;
  SSExpCode?: string;
  TaxExpCode?: string;
  SalExpCode?: string;
}

export interface EntityUpdate {
  Name?: string;
  CurrencyCode?: string;
  SSAccCode?: string;
  TaxAccCode?: string;
  SSExpCode?: string;
  TaxExpCode?: string;
  SalExpCode?: string;
}
