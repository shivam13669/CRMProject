import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Customer } from '@shared/api';
import { normalizeContact } from '@/utils/phone';
import { computeExpiryDate, formatDateLocalISO } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';

interface CustomerContextType {
  customers: Customer[];
  loading: boolean;
  addCustomer: (customer: Customer) => Promise<{ success: boolean; message: string }>;
  addCustomers: (newCustomers: Customer[]) => Promise<{ success: boolean; message: string }>;
  updateCustomer: (id: string, updatedCustomer: Partial<Customer>) => Promise<{ success: boolean; message: string }>;
  deleteCustomer: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteSelectedCustomers: (ids: string[]) => Promise<{ success: boolean; message: string }>;
  clearAllCustomers: () => Promise<{ success: boolean; message: string }>;
  loadCustomers: () => Promise<void>;
  getStats: () => {
    total: number;
    families: number;
    individuals: number;
    active: number;
    inactive: number;
  };
  // Documents
  listDocuments: (customerId: string) => Promise<any[]>;
  uploadDocument: (customerId: string, file: File, type: string) => Promise<{ success: boolean; message: string }>;
  deleteDocument: (docId: string) => Promise<{ success: boolean; message: string }>;
  // History
  getHistory: (customerId: string) => Promise<any[]>;
  addHistory: (customerId: string, action: string, note?: string) => Promise<{ success: boolean; message: string }>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const useCustomers = () => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomers must be used within a CustomerProvider');
  }
  return context;
};

interface CustomerProviderProps {
  children: ReactNode;
}

// Helper to safely read and parse a response body exactly once.
// Reads text, attempts JSON.parse, and returns structured data without re-reading the stream.
const parseResponse = async (response: Response) => {
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Non-JSON response, expose raw text under message
      data = { message: text };
    }
  }
  return { ok: response.ok, status: response.status, data };
};

export const CustomerProvider: React.FC<CustomerProviderProps> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // API base URL
  const apiUrl = '/api/customers';

  // Use AuthContext token so we react to login/logout
  // Importing useAuth from AuthContext ensures we reload customers whenever token changes
  const { token } = useAuth();

  // API headers with authentication
  const getApiHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Load customers when auth token becomes available, and clear on logout
  useEffect(() => {
    if (token) {
      loadCustomers();
    } else {
      // Clear customers when logged out
      setCustomers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      if (!token) return; // avoid network call without auth
      const response = await fetch(apiUrl, { headers: getApiHeaders() });

      const parsed = await parseResponse(response);
      if (parsed.ok) {
        const result = parsed.data || {};
        if (result.success) {
          setCustomers((result.data || []).map((c: Customer) => ({ ...c, contact: normalizeContact(c.contact) })));
        }
      } else {
        console.warn('Failed to load customers', parsed.status, parsed.data);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async (customer: Customer) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(customer)
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        await loadCustomers();
        return { success: true, message: result.message || 'Customer added' };
      }

      const message = result.message || `Failed to add customer (status ${parsed.status})`;
      return { success: false, message };
    } catch (error) {
      console.error('Error adding customer:', error);
      return { success: false, message: 'Failed to add customer' };
    } finally {
      setLoading(false);
    }
  };

  const addCustomers = async (newCustomers: Customer[]) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/bulk`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ customers: newCustomers })
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        // Reload customers from database to get updated data
        await loadCustomers();
        return { success: true, message: result.message };
      } else {
        console.error('Failed to add customers:', result.message || parsed.data || parsed.status);
        return { success: false, message: result.message || `Failed to add customers (status ${parsed.status})` };
      }
    } catch (error) {
      console.error('Error adding customers:', error);
      return { success: false, message: 'Failed to add customers' };
    } finally {
      setLoading(false);
    }
  };

  const updateCustomer = async (id: string, updatedCustomer: Partial<Customer>) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(updatedCustomer)
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        // Reload customers from database to get updated data
        await loadCustomers();
        return { success: true, message: result.message };
      } else {
        console.error('Failed to update customer:', result.message || parsed.data || parsed.status);
        return { success: false, message: result.message || `Failed to update customer (status ${parsed.status})` };
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      return { success: false, message: 'Failed to update customer' };
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        // Reload customers from database to get updated data
        await loadCustomers();
        return { success: true, message: result.message };
      } else {
        console.error('Failed to delete customer:', result.message || parsed.data || parsed.status);
        return { success: false, message: result.message || `Failed to delete customer (status ${parsed.status})` };
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      return { success: false, message: 'Failed to delete customer' };
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedCustomers = async (ids: string[]) => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: getApiHeaders(),
        body: JSON.stringify({ ids })
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        // Reload customers from database to get updated data
        await loadCustomers();
        return { success: true, message: result.message };
      } else {
        console.error('Failed to delete customers:', result.message || parsed.data || parsed.status);
        return { success: false, message: result.message || `Failed to delete customers (status ${parsed.status})` };
      }
    } catch (error) {
      console.error('Error deleting customers:', error);
      return { success: false, message: 'Failed to delete customers' };
    } finally {
      setLoading(false);
    }
  };

  const clearAllCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/all/clear`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) {
        // Clear local state immediately
        setCustomers([]);
        return { success: true, message: result.message };
      } else {
        console.error('Failed to clear customers:', result.message || parsed.data || parsed.status);
        return { success: false, message: result.message || `Failed to clear customers (status ${parsed.status})` };
      }
    } catch (error) {
      console.error('Error clearing customers:', error);
      return { success: false, message: 'Failed to clear customers' };
    } finally {
      setLoading(false);
    }
  };

  const getStats = () => {
    const total = customers.length;
    const families = customers.filter(c => c.familyType === 'Family').length;
    const individuals = customers.filter(c => c.familyType === 'Individual').length;
    const today = formatDateLocalISO(new Date());
    const isExpired = (c: Customer) => {
      const exp = (c as any).expireDate || computeExpiryDate(c.joinDate);
      return !!exp && exp < today;
    };
    const active = customers.filter(c => !isExpired(c) && c.status === 'Active').length;
    const inactive = customers.filter(c => isExpired(c) || c.status === 'Inactive').length;

    return { total, families, individuals, active, inactive };
  };

  // Documents
  const listDocuments = async (customerId: string) => {
    try {
      const response = await fetch(`${apiUrl}/${customerId}/documents`, { headers: getApiHeaders() });
      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      return parsed.ok && result.success ? result.data || [] : [];
    } catch (e) {
      console.error('listDocuments error', e);
      return [];
    }
  };

  const uploadDocument = async (customerId: string, file: File, type: string) => {
    try {
      setLoading(true);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = (reader.result as string) || '';
          const b64 = res.split(',')[1] || '';
          resolve(b64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${apiUrl}/${customerId}/documents`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ filename: file.name, type, contentBase64: base64 })
      });
      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) return { success: true, message: 'Uploaded' };
      return { success: false, message: result.message || `Upload failed (status ${parsed.status})` };
    } catch (e) {
      console.error('uploadDocument error', e);
      return { success: false, message: 'Upload failed' };
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customers/documents/${docId}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });
      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) return { success: true, message: 'Deleted' };
      return { success: false, message: result.message || `Delete failed (status ${parsed.status})` };
    } catch (e) {
      console.error('deleteDocument error', e);
      return { success: false, message: 'Delete failed' };
    } finally {
      setLoading(false);
    }
  };

  // History
  const getHistory = async (customerId: string) => {
    try {
      const response = await fetch(`${apiUrl}/${customerId}/history`, { headers: getApiHeaders() });
      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      return parsed.ok && result.success ? result.data || [] : [];
    } catch (e) {
      console.error('getHistory error', e);
      return [];
    }
  };

  const addHistory = async (customerId: string, action: string, note?: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/${customerId}/history`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ action, note })
      });
      const parsed = await parseResponse(response);
      const result = parsed.data || {};
      if (parsed.ok && result.success) return { success: true, message: 'Added' };
      return { success: false, message: result.message || `Failed (status ${parsed.status})` };
    } catch (e) {
      console.error('addHistory error', e);
      return { success: false, message: 'Failed' };
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerContext.Provider
      value={{
        customers,
        addCustomer,
        addCustomers,
        updateCustomer,
        deleteCustomer,
        deleteSelectedCustomers,
        clearAllCustomers,
        getStats,
        loading,
        loadCustomers,
        listDocuments,
        uploadDocument,
        deleteDocument,
        getHistory,
        addHistory
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
