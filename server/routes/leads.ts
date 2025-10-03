import { RequestHandler } from 'express';
import { Lead } from '@shared/api';
import { leadDB } from '../database/lead-db';
import { customerDB } from '../database/db';

export const listLeads: RequestHandler = async (req, res) => {
  try {
    const { search, status, source, assignedTo } = req.query as any;
    const leads = await leadDB.list({ search, status, source, assignedTo });
    res.json({ success: true, data: leads });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to list leads' });
  }
};

export const addLead: RequestHandler = async (req, res) => {
  try {
    const lead = req.body as Lead;
    if (!lead.id) lead.id = `lead_${Date.now()}_${Math.random().toString(36).slice(2)}` as any;
    lead.status = lead.status || 'New';
    await leadDB.add(lead);
    res.status(201).json({ success: true, data: lead });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to add lead' });
  }
};

export const updateLead: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body as Partial<Lead>;
    const ok = await leadDB.patch(id, patch);
    if (!ok) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to update lead' }); }
};

export const deleteLead: RequestHandler = async (req, res) => {
  try { const { id } = req.params; await leadDB.remove(id); res.json({ success: true }); } catch(e){ res.status(500).json({ success: false, message: 'Failed to delete lead' }); }
};

export const addLeadHistory: RequestHandler = async (req, res) => {
  try { const { id } = req.params; const { action, note } = req.body as any; if (!action) return res.status(400).json({ success:false, message:'action required' }); const entryId = `${id}_hist_${Date.now()}_${Math.random().toString(36).slice(2)}`; await leadDB.addHistory({ id: entryId, leadId: id, action, note }); res.status(201).json({ success: true }); } catch(e){ res.status(500).json({ success:false, message:'Failed to add history' }); }
};

export const getLeadHistory: RequestHandler = async (req, res) => {
  try { const { id } = req.params; const items = await leadDB.history(id); res.json({ success: true, data: items }); } catch(e){ res.status(500).json({ success:false, message:'Failed to get history' }); }
};

// Convert lead to customer
export const convertLead: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { membership = 'Silver', familyType = 'Individual', salesmanId = '' } = req.body as any;
    // Read current lead state
    const leads = await leadDB.list({});
    const lead = leads.find(l => l.id === id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const now = Date.now();
    const customerId = `cust_${now}_${Math.random().toString(36).slice(2)}`;
    const regId = `REG${now}`;

    const customer = {
      id: customerId,
      regId,
      name: lead.name,
      contact: lead.contact,
      salesmanId,
      status: 'Active',
      familyType,
      familyMembers: familyType === 'Family' ? 'No details' : 'No family',
      joinDate: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`,
      membership,
      notes: lead.notes || '',
      tags: lead.tags || []
    } as any;

    const ok = await customerDB.addCustomer(customer);
    if (!ok) return res.status(500).json({ success: false, message: 'Failed to create customer' });

    await leadDB.patch(id, { status: 'Converted', linkedCustomerId: customerId });
    await leadDB.addHistory({ id: `${id}_hist_${Date.now()}`, leadId: id, action: 'Converted', note: `Created customer ${regId}` });
    await customerDB.addHistory({ id: `${customerId}_hist_${Date.now()}`, customerId, action: 'Created from Lead', note: `Lead ${id}` });

    res.status(201).json({ success: true, data: { customerId, regId } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Conversion failed' });
  }
};
