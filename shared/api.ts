/**
 * Shared code between client and server
 * Healthcare CRM API types and interfaces
 */

// Authentication types
export type AdminRole = 'central' | 'admin';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

export interface CreateAdminRequest {
  name: string;
  username: string;
  password: string;
  role?: AdminRole; // defaults to 'admin' server-side
}

// Customer data types
export interface Customer {
  id: string;
  regId: string;
  name: string;
  contact: string;
  salesmanId: string;
  status: 'Active' | 'Inactive';
  familyType: 'Family' | 'Individual';
  familyMembers: string;
  joinDate: string;
  expireDate?: string;
  membership?: 'Gold' | 'Silver' | 'Platinum';
  // New optional fields
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerDocument {
  id: string;
  customerId: string;
  type: 'Aadhaar' | 'Aadhar' | 'PAN' | 'Other';
  filename: string;
  url: string;
  uploadedAt: string;
}

export interface CustomerHistoryEntry {
  id: string;
  customerId: string;
  action: string;
  note?: string;
  createdAt: string;
}

// Lead management
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
export type LeadPriority = 'Low' | 'Medium' | 'High';

export interface Lead {
  id: string;
  name: string;
  contact: string;
  source?: 'Web' | 'Call' | 'WhatsApp' | 'Other';
  status: LeadStatus;
  priority?: LeadPriority;
  score?: number; // 0-100
  assignedTo?: string; // user id or username
  notes?: string;
  tags?: string[];
  nextActionAt?: string; // ISO
  createdAt?: string;
  updatedAt?: string;
  linkedCustomerId?: string; // if converted
}

export interface LeadHistoryEntry {
  id: string;
  leadId: string;
  action: string;
  note?: string;
  createdAt: string;
}

// Dashboard stats types
export interface DashboardStats {
  totalCustomers: number;
  totalFamilies: number;
  totalIndividuals: number;
  activeCustomers: number;
  inactiveCustomers: number;
  membershipBreakdown: {
    gold: number;
    silver: number;
    platinum: number;
  };
}

export interface MonthlyTrend {
  month: string;
  enrollments: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DemoResponse {
  message: string;
}
