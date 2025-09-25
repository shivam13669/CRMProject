import { RequestHandler } from "express";
import { customerDB } from "../database/db";
import { Customer } from "@shared/api";
import fs from "fs/promises";
import path from "path";

// Get all customers with optional filters
export const getCustomers: RequestHandler = async (req, res) => {
  try {
    const { search, status, familyType, salesmanId } = req.query;

    const filters = {
      search: search as string,
      status: status as string,
      familyType: familyType as string,
      salesmanId: salesmanId as string
    };

    const customers = await customerDB.searchCustomers(filters);

    res.json({
      success: true,
      data: customers,
      total: customers.length
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get customer by ID
export const getCustomerById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await customerDB.getCustomerById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Add single customer
export const addCustomer: RequestHandler = async (req, res) => {
  try {
    const body = req.body as Partial<Customer>;

    // Validate required fields
    if (!body.regId || !body.name || !body.contact) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: regId, name, or contact'
      });
    }

    // Check if customer with same regId already exists
    const existing = await customerDB.getCustomerByRegId(body.regId);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Customer with this registration ID already exists'
      });
    }

    // Normalize and set sensible defaults for NOT NULL fields
    const customerData: Customer = {
      id: body.id || `${body.regId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      regId: String(body.regId).trim(),
      name: String(body.name).trim(),
      contact: String(body.contact).trim(),
      salesmanId: (body.salesmanId ?? 'unassigned').toString().trim() || 'unassigned',
      status: (body.status ?? 'Active') as Customer['status'],
      familyType: (body.familyType ?? 'Individual') as Customer['familyType'],
      familyMembers: (body.familyMembers ?? '').toString(),
      joinDate: body.joinDate ? String(body.joinDate) : new Date().toISOString().slice(0, 10),
      expireDate: body.expireDate ? String(body.expireDate) : undefined,
      membership: (body.membership ?? 'Silver') as Customer['membership'],
      notes: (body as any).notes,
      tags: Array.isArray((body as any).tags) ? (body as any).tags : undefined
    };

    const success = await customerDB.addCustomer(customerData);

    if (success) {
      res.status(201).json({
        success: true,
        message: 'Customer added successfully',
        data: customerData
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to add customer'
      });
    }
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Add multiple customers (bulk upload)
export const addCustomers: RequestHandler = async (req, res) => {
  try {
    const customers = req.body.customers as Partial<Customer>[];

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customers data. Expected array of customers.'
      });
    }

    // Validate and prepare customers
    const validatedCustomers: Customer[] = [];
    const errors: string[] = [];

    for (const [index, c] of customers.entries()) {
      if (!c.regId || !c.name || !c.contact) {
        errors.push(`Customer ${index + 1}: Missing required fields`);
        continue;
      }

      const normalized: Customer = {
        id: c.id || `${c.regId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        regId: String(c.regId).trim(),
        name: String(c.name).trim(),
        contact: String(c.contact).trim(),
        salesmanId: (c.salesmanId ?? 'unassigned').toString().trim() || 'unassigned',
        status: (c.status ?? 'Active') as Customer['status'],
        familyType: (c.familyType ?? 'Individual') as Customer['familyType'],
        familyMembers: (c.familyMembers ?? '').toString(),
        joinDate: c.joinDate ? String(c.joinDate) : new Date().toISOString().slice(0, 10),
        expireDate: c.expireDate ? String(c.expireDate) : undefined,
        membership: (c.membership ?? 'Silver') as Customer['membership'],
        notes: (c as any).notes,
        tags: Array.isArray((c as any).tags) ? (c as any).tags : undefined
      };

      validatedCustomers.push(normalized);
    }

    if (validatedCustomers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid customers to add',
        errors
      });
    }

    const result = await customerDB.addCustomers(validatedCustomers);

    res.json({
      success: result.success,
      message: `Successfully added ${result.added} customers`,
      added: result.added,
      errors: result.errors.concat(errors),
      total: validatedCustomers.length
    });
  } catch (error) {
    console.error('Error adding customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update customer
export const updateCustomer: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<Customer>;

    const success = await customerDB.updateCustomer(id, updates);

    if (success) {
      const updatedCustomer = await customerDB.getCustomerById(id);
      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: updatedCustomer
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Customer not found or update failed'
      });
    }
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete customer
export const deleteCustomer: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await customerDB.deleteCustomer(id);

    if (success) {
      res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete multiple customers
export const deleteCustomers: RequestHandler = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer IDs. Expected array of IDs.'
      });
    }

    const result = await customerDB.deleteCustomers(ids);

    res.json({
      success: result.success,
      message: `Successfully deleted ${result.deleted} customers`,
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Error deleting customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Clear all customers
export const clearAllCustomers: RequestHandler = async (req, res) => {
  try {
    const success = await customerDB.clearAllCustomers();

    if (success) {
      res.json({
        success: true,
        message: 'All customers cleared successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear customers'
      });
    }
  } catch (error) {
    console.error('Error clearing customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear customers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get customer statistics
export const getCustomerStats: RequestHandler = async (req, res) => {
  try {
    const stats = await customerDB.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// List documents for a customer
export const listCustomerDocuments: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const docs = await customerDB.listDocuments(id);
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ success: false, message: 'Failed to list documents' });
  }
};

// Upload a document (expects base64 JSON body)
export const uploadCustomerDocument: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { filename, type, contentBase64 } = req.body as { filename: string; type: string; contentBase64: string };
    if (!filename || !contentBase64) {
      return res.status(400).json({ success: false, message: 'filename and contentBase64 are required' });
    }

    // Enforce single document per customer
    const existing = await customerDB.listDocuments(id);
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Document already exists for this customer. Delete it to upload a new one.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    try { await fs.mkdir(uploadsDir, { recursive: true }); } catch {}

    const ext = path.extname(filename) || '.bin';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    const buffer = Buffer.from(contentBase64, 'base64');
    await fs.writeFile(filePath, buffer);

    const docId = `${id}_doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ok = await customerDB.addDocument({ id: docId, customerId: id, type: type || 'Other', filename, filepath: filePath });
    if (!ok) {
      try { await fs.unlink(filePath); } catch {}
      return res.status(500).json({ success: false, message: 'Failed to save document' });
    }

    res.status(201).json({
      success: true,
      data: {
        id: docId,
        customerId: id,
        type: type || 'Other',
        filename,
        url: `/uploads/${safeName}`,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Delete a document
export const deleteCustomerDocument: RequestHandler = async (req, res) => {
  try {
    const { docId } = req.params as { docId: string };
    const ok = await customerDB.deleteDocument(docId);
    if (!ok) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};

// Get history
export const getCustomerHistory: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await customerDB.getHistory(id);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};

// Add history entry
export const addCustomerHistory: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body as { action: string; note?: string };
    if (!action) return res.status(400).json({ success: false, message: 'action is required' });
    const entryId = `${id}_hist_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ok = await customerDB.addHistory({ id: entryId, customerId: id, action, note });
    if (!ok) return res.status(500).json({ success: false, message: 'Failed to add history' });
    res.status(201).json({ success: true, data: { id: entryId, customerId: id, action, note, createdAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Error adding history:', error);
    res.status(500).json({ success: false, message: 'Failed to add history' });
  }
};
