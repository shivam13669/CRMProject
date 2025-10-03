import { Lead, LeadHistoryEntry } from '@shared/api';
import { customerDB } from './db';
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs/promises';

const LEAD_SOURCES: Exclude<Lead['source'], undefined>[] = ['Web', 'Call', 'WhatsApp', 'Other'];
const LEAD_STATUSES: Lead['status'][] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const LEAD_PRIORITIES: Exclude<Lead['priority'], undefined>[] = ['Low', 'Medium', 'High'];

const normalizeLeadSource = (value: unknown): Lead['source'] => {
  if (value == null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  const match = LEAD_SOURCES.find(source => source.toLowerCase() === normalized.toLowerCase());
  return match ?? 'Other';
};

const normalizeLeadStatus = (value: unknown): Lead['status'] => {
  const normalized = String(value ?? '').trim();
  const match = LEAD_STATUSES.find(status => status.toLowerCase() === normalized.toLowerCase());
  return match ?? 'New';
};

const normalizeLeadPriority = (value: unknown): Lead['priority'] => {
  if (value == null || value === '') {
    return 'Medium';
  }
  const normalized = String(value).trim();
  const match = LEAD_PRIORITIES.find(priority => priority.toLowerCase() === normalized.toLowerCase());
  return match ?? 'Medium';
};

let SQL: any;
let db: any;
let isInitialized = false;
const dbPath = path.join(process.cwd(), 'customer_management.db');

async function ensure() {
  if (!isInitialized) {
    SQL = await initSqlJs();
    try {
      const buf = await fs.readFile(dbPath);
      db = new SQL.Database(new Uint8Array(buf));
    } catch {
      db = new SQL.Database();
    }
    isInitialized = true;
  }
}

async function save() {
  const data = db.export();
  await fs.writeFile(dbPath, Buffer.from(data));
}

export const leadDB = {
  async list(filters: { search?: string; status?: string; source?: string; assignedTo?: string }): Promise<Lead[]> {
    await ensure();
    let q = 'SELECT * FROM leads WHERE 1=1';
    const p: any[] = [];
    if (filters.search) { q += ' AND (name LIKE ? OR contact LIKE ?)'; const s = `%${filters.search}%`; p.push(s,s); }
    if (filters.status && filters.status !== 'all') { q += ' AND status = ?'; p.push(filters.status); }
    if (filters.source && filters.source !== 'all') { q += ' AND source = ?'; p.push(filters.source); }
    if (filters.assignedTo && filters.assignedTo !== 'all') { q += ' AND assignedTo = ?'; p.push(filters.assignedTo); }
    q += ' ORDER BY created_at DESC';
    const stmt = db.prepare(q); stmt.bind(p);
    const out: Lead[] = [] as any;
    while (stmt.step()) {
      const r = stmt.getAsObject();
      out.push({
        id: String(r.id),
        name: String(r.name),
        contact: String(r.contact),
        source: normalizeLeadSource(r.source),
        status: normalizeLeadStatus(r.status),
        priority: normalizeLeadPriority(r.priority),
        score: Number(r.score || 0),
        assignedTo: r.assignedTo ? String(r.assignedTo) : undefined,
        notes: r.notes ? String(r.notes) : undefined,
        tags: String(r.tags || '').split(',').filter(Boolean),
        nextActionAt: r.nextActionAt ? String(r.nextActionAt) : undefined,
        linkedCustomerId: r.linkedCustomerId ? String(r.linkedCustomerId) : undefined,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at)
      });
    }
    return out;
  },

  async add(lead: Lead): Promise<boolean> {
    await ensure();
    db.run(
      `INSERT INTO leads (id,name,contact,source,status,priority,score,assignedTo,notes,tags,nextActionAt,linkedCustomerId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        lead.id,
        lead.name,
        lead.contact,
        normalizeLeadSource(lead.source) ?? null,
        normalizeLeadStatus(lead.status),
        normalizeLeadPriority(lead.priority),
        lead.score || 0,
        lead.assignedTo || null,
        lead.notes || null,
        Array.isArray(lead.tags) ? lead.tags.join(',') : '',
        lead.nextActionAt || null,
        lead.linkedCustomerId || null
      ]
    );
    await save();
    return true;
  },

  async patch(id: string, patch: Partial<Lead>): Promise<boolean> {
    await ensure();
    const cur = db.prepare('SELECT * FROM leads WHERE id = ?'); cur.bind([id]); if (!cur.step()) return false; const c = cur.getAsObject();
    const n = { ...c, ...patch };
    db.run(
      `UPDATE leads SET name=?, contact=?, source=?, status=?, priority=?, score=?, assignedTo=?, notes=?, tags=?, nextActionAt=?, linkedCustomerId=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [
        n.name,
        n.contact,
        normalizeLeadSource(n.source) ?? null,
        normalizeLeadStatus(n.status),
        normalizeLeadPriority(n.priority),
        Number(n.score || 0),
        n.assignedTo || null,
        n.notes || null,
        String(n.tags || ''),
        n.nextActionAt || null,
        n.linkedCustomerId || null,
        id
      ]
    );
    await save();
    return true;
  },

  async remove(id: string): Promise<boolean> {
    await ensure(); db.run('DELETE FROM leads WHERE id = ?', [id]); await save(); return true;
  },

  async addHistory(entry: { id: string; leadId: string; action: string; note?: string }): Promise<boolean> {
    await ensure(); db.run('INSERT INTO lead_history (id,leadId,action,note) VALUES (?,?,?,?)', [entry.id, entry.leadId, entry.action, entry.note || null]); await save(); return true;
  },

  async history(leadId: string): Promise<LeadHistoryEntry[]> {
    await ensure(); const stmt = db.prepare('SELECT id,leadId,action,note,created_at FROM lead_history WHERE leadId = ? ORDER BY created_at DESC'); stmt.bind([leadId]); const out: LeadHistoryEntry[] = [] as any; while (stmt.step()){ const r = stmt.getAsObject(); out.push({ id: String(r.id), leadId: String(r.leadId), action: String(r.action), note: r.note != null ? String(r.note): undefined, createdAt: String(r.created_at)});} return out;
  }
};
