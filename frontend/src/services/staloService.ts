import api from './api';
import type { Project, Position, Resource, Allocation, MonthlyAllocationSummary, AllocationFormData, DragAllocationData, PayrollResource, PayrollRecord } from '../types';
import type { SystemUser, SystemUserUpdate, SystemUserCreate } from '../types/systemUsers';
import type { Entity, EntityCreate, EntityUpdate } from '../types/entities';

// Combined endpoint for Positions page - single API call for all data
// Supports optional date filtering for better performance
export interface PositionsCombinedData {
  positions: Position[];
  projects: Project[];
  resources: Resource[];
  allocations: Allocation[];
}

export interface PositionsCombinedParams {
  startMonth?: string; // Format: YYYY-MM
  endMonth?: string;   // Format: YYYY-MM
}

export const getPositionsCombinedData = async (params?: PositionsCombinedParams): Promise<PositionsCombinedData> => {
  const queryParams = new URLSearchParams();
  if (params?.startMonth) queryParams.append('startMonth', params.startMonth);
  if (params?.endMonth) queryParams.append('endMonth', params.endMonth);
  
  const queryString = queryParams.toString();
  const url = queryString ? `/positions/combined?${queryString}` : '/positions/combined';
  const response = await api.get(url);
  return response.data;
};

// Projects
export const getProjects = async (): Promise<Project[]> => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<Project> => {
  const response = await api.put(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/projects/${id}`);
};

export const getProjectPositions = async (id: string): Promise<Position[]> => {
  const response = await api.get(`/projects/${id}/positions`);
  return response.data;
};

// Resources
export const getResources = async (): Promise<Resource[]> => {
  const response = await api.get('/resources');
  return response.data;
};

export const getResource = async (id: string): Promise<Resource> => {
  const response = await api.get(`/resources/${id}`);
  return response.data;
};

// Allocations
// Debug function to test allocation endpoint
export const debugAllocation = async (data: AllocationFormData): Promise<any> => {
  console.log('Debug: Sending to debug endpoint');
  try {
    const response = await api.post('/debug-allocation', data);
    console.log('Debug response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Debug error:', error.response?.data || error.message);
    throw error;
  }
};

export const getAllocations = async (): Promise<Allocation[]> => {
  const response = await api.get('/allocations');
  return response.data;
};

export const createAllocation = async (data: AllocationFormData): Promise<Allocation> => {
  const response = await api.post('/allocations', data);
  return response.data;
};

export const createDragAllocation = async (data: DragAllocationData): Promise<Allocation> => {
  const response = await api.post('/allocations', data);
  return response.data;
};

export const updateAllocation = async (id: string, data: Partial<AllocationFormData>): Promise<Allocation> => {
  const response = await api.put(`/allocations/${id}`, data);
  return response.data;
};

export const deleteAllocation = async (id: string): Promise<void> => {
  await api.delete(`/allocations/${id}`);
};

export const getMonthlyAllocations = async (
  projectId: string,
  startDate: string,
  endDate: string
): Promise<MonthlyAllocationSummary[]> => {
  const response = await api.get(`/allocations/project/${projectId}/monthly`, {
    params: { startDate, endDate },
  });
  return response.data;
};

// System Users
export const getSystemUsers = async (): Promise<SystemUser[]> => {
  const response = await api.get('/system-users');
  return response.data;
};

export const updateSystemUser = async (id: string, data: SystemUserUpdate): Promise<SystemUser> => {
  const response = await api.put(`/system-users/${id}`, data);
  return response.data;
};

export const createSystemUser = async (data: SystemUserCreate): Promise<SystemUser> => {
  const response = await api.post('/system-users', data);
  return response.data;
};

export const deleteSystemUser = async (id: string): Promise<void> => {
  await api.delete(`/system-users/${id}`);
};

// Entities
export const getEntities = async (): Promise<Entity[]> => {
  const response = await api.get('/entities');
  return response.data;
};

export const createEntity = async (data: EntityCreate): Promise<Entity> => {
  const response = await api.post('/entities', data);
  return response.data;
};

export const updateEntity = async (id: string, data: EntityUpdate): Promise<Entity> => {
  const response = await api.put(`/entities/${id}`, data);
  return response.data;
};

export const deleteEntity = async (id: string): Promise<void> => {
  await api.delete(`/entities/${id}`);
};

// Positions
export const getPositions = async (): Promise<Position[]> => {
  const response = await api.get('/positions');
  return response.data;
};

// Validate position allocations - ensures Allocated flag matches actual allocation entries
export const validatePositionAllocations = async (): Promise<{
  success: boolean;
  totalPositions: number;
  totalAllocations: number;
  changesCount: number;
  changes: { action: string; positionId: string; positionName: string; details: string }[];
}> => {
  const response = await api.post('/positions/validate-allocations');
  return response.data;
};

export const getPosition = async (id: string): Promise<Position> => {
  const response = await api.get(`/positions/${id}`);
  return response.data;
};

export const createPosition = async (data: Partial<Position>): Promise<Position> => {
  const response = await api.post('/positions', data);
  return response.data;
};

export const updatePosition = async (id: string, data: Partial<Position>): Promise<Position> => {
  const response = await api.put(`/positions/${id}`, data);
  return response.data;
};

export const deletePosition = async (id: string): Promise<void> => {
  await api.delete(`/positions/${id}`);
};

// Validate positions for given months - ensures all positions appear exactly once
export const validatePositions = async (monthYears: string[]): Promise<{
  success: boolean;
  totalPositions: number;
  totalAllocations: number;
  changesCount: number;
  changes: { action: string; positionId: string; positionName: string; details: string }[];
}> => {
  const response = await api.post('/allocations/validate-positions', { monthYears });
  return response.data;
};

// Resources CRUD
export const createResource = async (data: Partial<Resource>): Promise<Resource> => {
  const response = await api.post('/resources', data);
  return response.data;
};

export const updateResource = async (id: string, data: Partial<Resource>): Promise<Resource> => {
  const response = await api.put(`/resources/${id}`, data);
  return response.data;
};

export const deleteResource = async (id: string): Promise<void> => {
  await api.delete(`/resources/${id}`);
};

// Payroll Allocation
export const getPayrollProjects = async (month: string): Promise<any[]> => {
  const response = await api.get('/payroll/projects', { params: { month } });
  return response.data;
};

export const getPayrollResources = async (month: string): Promise<PayrollResource[]> => {
  const response = await api.get('/payroll', { params: { month } });
  return response.data;
};

export const getPayrollRecords = async (month: string): Promise<PayrollRecord[]> => {
  const response = await api.get('/payroll/all', { params: { month } });
  return response.data;
};

export const createOrUpdatePayrollRecord = async (data: Partial<PayrollRecord>): Promise<PayrollRecord> => {
  const response = await api.post('/payroll', data);
  return response.data;
};

// Lock/unlock payroll records
export const lockPayrollRecords = async (recordIds: string[], locked: boolean): Promise<{
  success: boolean;
  updatedCount: number;
  locked: boolean;
}> => {
  const response = await api.patch('/payroll/lock', { recordIds, locked });
  return response.data;
};

// Lock/unlock all payroll records for a month
export const lockPayrollMonth = async (month: string, locked: boolean): Promise<{
  success: boolean;
  updatedCount: number;
  month: string;
  locked: boolean;
}> => {
  const response = await api.patch('/payroll/lock-month', { month, locked });
  return response.data;
};
