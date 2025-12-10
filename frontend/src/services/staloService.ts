import api from './api';
import type { Project, Position, Resource, Allocation, MonthlyAllocationSummary, AllocationFormData, DragAllocationData } from '../types';
import type { SystemUser, SystemUserUpdate, SystemUserCreate } from '../types/systemUsers';
import type { Entity, EntityCreate, EntityUpdate } from '../types/entities';

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
