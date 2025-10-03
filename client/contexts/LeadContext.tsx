import React, { createContext, useContext, useEffect, useState } from 'react';
import { Lead } from '@shared/api';

interface LeadContextType {
  leads: Lead[];
  loading: boolean;
  loadLeads: (filters?: Partial<{ search: string; status: string; source: string; assignedTo: string }>) => Promise<void>;
  addLead: (lead: Lead) => Promise<{ success: boolean; message: string }>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<{ success: boolean; message: string }>;
  deleteLead: (id: string) => Promise<{ success: boolean; message: string }>;
  addHistory: (id: string, action: string, note?: string) => Promise<void>;
  convert: (id: string, payload?: { membership?: string; familyType?: 'Family'|'Individual'; salesmanId?: string }) => Promise<{ success: boolean; message: string }>;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);
export const useLeads = () => { const ctx = useContext(LeadContext); if (!ctx) throw new Error('useLeads must be used within LeadProvider'); return ctx; };

export const LeadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const apiUrl = '/api/leads';
  const token = () => localStorage.getItem('healthcare_crm_token');
  const headers = () => { const h: Record<string,string> = { 'Content-Type': 'application/json' }; const t = token(); if (t) h['Authorization'] = `Bearer ${t}`; return h; };

  const loadLeads = async (filters?: any) => {
    try { setLoading(true); const qs = filters ? '?' + new URLSearchParams(filters).toString() : ''; const res = await fetch(apiUrl + qs, { headers: headers() }); const j = await res.json(); if (j.success) setLeads(j.data || []); } finally { setLoading(false); }
  };
  useEffect(()=>{ if (token()) loadLeads(); },[]);

  const addLead = async (lead: Lead) => {
    try { setLoading(true); const res = await fetch(apiUrl, { method:'POST', headers: headers(), body: JSON.stringify(lead)}); const j = await res.json(); if (j.success) { await loadLeads(); return { success:true, message:'Lead added' }; } return { success:false, message: j.message || 'Failed' }; } finally { setLoading(false); }
  };

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    try { setLoading(true); const res = await fetch(`${apiUrl}/${id}`, { method:'PUT', headers: headers(), body: JSON.stringify(patch)}); const j = await res.json(); if (j.success) { await loadLeads(); return { success:true, message:'Updated' }; } return { success:false, message: j.message || 'Failed' }; } finally { setLoading(false); }
  };

  const deleteLead = async (id: string) => {
    try { setLoading(true); const res = await fetch(`${apiUrl}/${id}`, { method:'DELETE', headers: headers()}); const j = await res.json(); if (j.success) { await loadLeads(); return { success:true, message:'Deleted' }; } return { success:false, message: j.message || 'Failed' }; } finally { setLoading(false); }
  };

  const addHistory = async (id: string, action: string, note?: string) => {
    await fetch(`${apiUrl}/${id}/history`, { method:'POST', headers: headers(), body: JSON.stringify({ action, note })});
  };

  const convert = async (id: string, payload?: any) => {
    try { setLoading(true); const res = await fetch(`${apiUrl}/${id}/convert`, { method:'POST', headers: headers(), body: JSON.stringify(payload || {})}); const j = await res.json(); if (j.success) return { success:true, message:'Converted' }; return { success:false, message:j.message || 'Failed' }; } finally { setLoading(false); }
  };

  return (
    <LeadContext.Provider value={{ leads, loading, loadLeads, addLead, updateLead, deleteLead, addHistory, convert }}>
      {children}
    </LeadContext.Provider>
  );
};
