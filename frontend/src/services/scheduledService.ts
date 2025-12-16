import api from './api';

export interface ScheduledRecord {
  ScheduledID: number;
  Type: string;
  PurchaseDate: string;
  Supplier?: string;
  Description?: string;
  PurchaseCurrency: string;
  OriginalCurrencyValue: number;
  USDValue: number;
  UsefulMonths: number;
  Disposed: boolean;
  DisposalDate?: string | null;
}

export interface CreateScheduledRecord {
  Type: string;
  PurchaseDate: string;
  Supplier?: string;
  Description?: string;
  PurchaseCurrency: string;
  OriginalCurrencyValue: number;
  USDValue: number;
  UsefulMonths: number;
  Disposed: boolean;
  DisposalDate?: string | null;
}

export interface UpdateScheduledRecord {
  Type?: string;
  PurchaseDate?: string;
  Supplier?: string;
  Description?: string;
  PurchaseCurrency?: string;
  OriginalCurrencyValue?: number;
  USDValue?: number;
  UsefulMonths?: number;
  Disposed?: boolean;
  DisposalDate?: string | null;
}

const scheduledService = {
  getAllScheduledRecords: async (): Promise<ScheduledRecord[]> => {
    const response = await api.get('/scheduled-records');
    return response.data;
  },

  getScheduledRecord: async (id: number): Promise<ScheduledRecord> => {
    const response = await api.get(`/scheduled-records/${id}`);
    return response.data;
  },

  createScheduledRecord: async (data: CreateScheduledRecord): Promise<ScheduledRecord> => {
    const response = await api.post('/scheduled-records', data);
    return response.data;
  },

  updateScheduledRecord: async (id: number, data: UpdateScheduledRecord): Promise<ScheduledRecord> => {
    const response = await api.put(`/scheduled-records/${id}`, data);
    return response.data;
  },

  deleteScheduledRecord: async (id: number): Promise<void> => {
    await api.delete(`/scheduled-records/${id}`);
  },
};

export default scheduledService;
