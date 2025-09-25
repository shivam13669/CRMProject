import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcrypt';
import { Customer, CustomerDocument, CustomerHistoryEntry, Lead, LeadHistoryEntry } from '@shared/api';
import initSqlJs from 'sql.js';

// Database state
let SQL: any;
let db: any;
let isInitialized = false;

// Database file path (now in root directory)
const dbPath = path.join(process.cwd(), 'customer_management.db');

// Initialize database
async function initializeDatabase() {
  try {
    // Initialize sql.js
    SQL = await initSqlJs();
    
    // Try to load existing database
    let dbData;
    try {
      const buffer = await fs.readFile(dbPath);
      dbData = new Uint8Array(buffer);
    } catch {
      // Database file doesn't exist, create new one
      dbData = null;
    }
    
    // Create or load database
    db = new SQL.Database(dbData);
    
    // Create tables if they don't exist
    await createTables();
    
    // Save database to file
    await saveDatabase();
    
    isInitialized = true;
    console.log(`SQLite database initialized successfully at: ${dbPath}`);
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Create database tables
async function createTables() {
  try {
    // Admin users table with password hashing
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customers table (base)
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        regId TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        salesmanId TEXT NOT NULL,
        status TEXT CHECK(status IN ('Active', 'Inactive')) NOT NULL DEFAULT 'Active',
        familyType TEXT CHECK(familyType IN ('Family', 'Individual')) NOT NULL,
        familyMembers TEXT NOT NULL,
        joinDate TEXT NOT NULL,
        expireDate TEXT,
        membership TEXT CHECK(membership IN ('Gold', 'Silver', 'Platinum')) NOT NULL DEFAULT 'Silver',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure new columns exist on customers
    const cols: string[] = [];
    try {
      const ti = db.exec(`PRAGMA table_info(customers)`);
      if (ti && ti[0] && ti[0].values) {
        for (const row of ti[0].values as any[]) cols.push(String(row[1]));
      }
    } catch {}
    if (!cols.includes('notes')) {
      try { db.run(`ALTER TABLE customers ADD COLUMN notes TEXT DEFAULT ''`); } catch {}
    }
    if (!cols.includes('tags')) {
      try { db.run(`ALTER TABLE customers ADD COLUMN tags TEXT DEFAULT ''`); } catch {}
    }
    if (!cols.includes('expireDate')) {
      try { db.run(`ALTER TABLE customers ADD COLUMN expireDate TEXT`); } catch {}
    }

    // Documents table (file metadata only)
    db.run(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        type TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    // History table
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_history (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        action TEXT NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    // Leads table
    db.run(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT NOT NULL,
        source TEXT,
        status TEXT CHECK(status IN ('New','Contacted','Qualified','Converted','Lost')) NOT NULL DEFAULT 'New',
        priority TEXT CHECK(priority IN ('Low','Medium','High')) DEFAULT 'Medium',
        score INTEGER DEFAULT 0,
        assignedTo TEXT,
        notes TEXT,
        tags TEXT DEFAULT '',
        nextActionAt TEXT,
        linkedCustomerId TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lead history
    db.run(`
      CREATE TABLE IF NOT EXISTS lead_history (
        id TEXT PRIMARY KEY,
        leadId TEXT NOT NULL,
        action TEXT NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(leadId) REFERENCES leads(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_customers_regId ON customers(regId)',
      'CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)',
      'CREATE INDEX IF NOT EXISTS idx_customers_familyType ON customers(familyType)',
      'CREATE INDEX IF NOT EXISTS idx_customers_salesmanId ON customers(salesmanId)',
      'CREATE INDEX IF NOT EXISTS idx_customers_joinDate ON customers(joinDate)',
      'CREATE INDEX IF NOT EXISTS idx_customers_expireDate ON customers(expireDate)',
      'CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)',
      'CREATE INDEX IF NOT EXISTS idx_documents_customerId ON documents(customerId)',
      'CREATE INDEX IF NOT EXISTS idx_history_customerId ON customer_history(customerId)',
      'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)',
      'CREATE INDEX IF NOT EXISTS idx_leads_assignedTo ON leads(assignedTo)',
      'CREATE INDEX IF NOT EXISTS idx_lead_history_leadId ON lead_history(leadId)'
    ];

    indexes.forEach(indexSql => {
      try {
        db.run(indexSql);
      } catch (error) {}
    });

    // Create default admin user if none exists
    await createDefaultAdmin();

    console.log('Database tables and indexes created successfully');
  } catch (error) {
    console.error('Error creating database tables:', error);
    throw error;
  }
}

// Create default admin user
async function createDefaultAdmin() {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM admins');
    stmt.step();
    const result = stmt.getAsObject();

    console.log('Checking admin count:', result.count);

    if (result.count === 0) {
      const defaultPassword = 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      db.run(`
        INSERT INTO admins (username, password_hash)
        VALUES (?, ?)
      `, ['admin@gmail.com', hashedPassword]);

      console.log('Default admin user created: username=admin@gmail.com, password=admin123');
      console.log('⚠️  Please change the default password in production!');

      await saveDatabase();
    } else {
      console.log('Admin user already exists, skipping creation');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Save database to file
async function saveDatabase() {
  try {
    const data = db.export();
    await fs.writeFile(dbPath, Buffer.from(data));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Ensure database is initialized
async function ensureInitialized() {
  if (!isInitialized) {
    await initializeDatabase();
  }
}

// Database service functions
export const customerDB = {
  // Get all customers
  async getAllCustomers(): Promise<Customer[]> {
    try {
      await ensureInitialized();
      const stmt = db.prepare('SELECT * FROM customers ORDER BY created_at DESC');
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results as Customer[];
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  },

  // Get customer by ID
  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      await ensureInitialized();
      const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
      stmt.bind([id]);
      
      if (stmt.step()) {
        return stmt.getAsObject() as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error getting customer by id:', error);
      return null;
    }
  },

  // Get customer by Registration ID
  async getCustomerByRegId(regId: string): Promise<Customer | null> {
    try {
      await ensureInitialized();
      const stmt = db.prepare('SELECT * FROM customers WHERE regId = ?');
      stmt.bind([regId]);
      
      if (stmt.step()) {
        return stmt.getAsObject() as Customer;
      }
      return null;
    } catch (error) {
      console.error('Error getting customer by regId:', error);
      return null;
    }
  },

  // Add single customer
  async addCustomer(customer: Customer): Promise<boolean> {
    try {
      await ensureInitialized();
      
      db.run(`
            INSERT INTO customers (id, regId, name, contact, salesmanId, status, familyType, familyMembers, joinDate, expireDate, membership, notes, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            customer.id,
            customer.regId,
            customer.name,
            customer.contact,
            customer.salesmanId,
            customer.status,
            customer.familyType,
            customer.familyMembers,
            customer.joinDate,
            (customer as any).expireDate || null,
            customer.membership || 'Silver',
            (customer as any).notes || '',
            Array.isArray((customer as any).tags) ? (customer as any).tags.join(',') : ((customer as any).tags || '')
          ]);

      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error adding customer:', error);
      return false;
    }
  },

  // Add multiple customers (bulk insert)
  async addCustomers(customers: Customer[]): Promise<{ success: boolean; added: number; errors: string[] }> {
    const errors: string[] = [];
    let added = 0;

    try {
      await ensureInitialized();
      
      for (const customer of customers) {
        try {
          db.run(`
            INSERT INTO customers (id, regId, name, contact, salesmanId, status, familyType, familyMembers, joinDate, expireDate, membership, notes, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            customer.id,
            customer.regId,
            customer.name,
            customer.contact,
            customer.salesmanId,
            customer.status,
            customer.familyType,
            customer.familyMembers,
            customer.joinDate,
            (customer as any).expireDate || null,
            customer.membership || 'Silver',
            (customer as any).notes || '',
            Array.isArray((customer as any).tags) ? (customer as any).tags.join(',') : ((customer as any).tags || '')
          ]);
          added++;
        } catch (error) {
          errors.push(`Error adding customer ${customer.regId}: ${error}`);
        }
      }
      
      await saveDatabase();
      return { success: true, added, errors };
    } catch (error) {
      return { success: false, added: 0, errors: [`Transaction failed: ${error}`] };
    }
  },

  // Update customer
  async updateCustomer(id: string, customer: Partial<Customer>): Promise<boolean> {
    try {
      await ensureInitialized();
      
      const existing = await this.getCustomerById(id);
      if (!existing) return false;

      const updated = { ...existing, ...customer };
      
      db.run(`
        UPDATE customers
        SET name = ?, contact = ?, salesmanId = ?, status = ?, familyType = ?, familyMembers = ?, joinDate = ?, expireDate = ?, membership = ?, notes = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        updated.name,
        updated.contact,
        updated.salesmanId,
        updated.status,
        updated.familyType,
        updated.familyMembers,
        updated.joinDate,
        (updated as any).expireDate || null,
        updated.membership || 'Silver',
        (updated as any).notes || '',
        Array.isArray((updated as any).tags) ? (updated as any).tags.join(',') : ((updated as any).tags || ''),
        id
      ]);
      
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      return false;
    }
  },

  // Delete customer by ID
  async deleteCustomer(id: string): Promise<boolean> {
    try {
      await ensureInitialized();
      
      db.run('DELETE FROM customers WHERE id = ?', [id]);
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  },

  // Delete multiple customers by IDs
  async deleteCustomers(ids: string[]): Promise<{ success: boolean; deleted: number }> {
    try {
      await ensureInitialized();
      
      let deleted = 0;
      for (const id of ids) {
        try {
          db.run('DELETE FROM customers WHERE id = ?', [id]);
          deleted++;
        } catch (error) {
          console.error(`Error deleting customer ${id}:`, error);
        }
      }
      
      await saveDatabase();
      return { success: true, deleted };
    } catch (error) {
      console.error('Error deleting customers:', error);
      return { success: false, deleted: 0 };
    }
  },

  // Clear all customers
  async clearAllCustomers(): Promise<boolean> {
    try {
      await ensureInitialized();
      
      db.run('DELETE FROM customers');
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error clearing customers:', error);
      return false;
    }
  },

  // Get customer statistics
  async getStats() {
    try {
      await ensureInitialized();
      
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN familyType = 'Family' THEN 1 ELSE 0 END) as families,
          SUM(CASE WHEN familyType = 'Individual' THEN 1 ELSE 0 END) as individuals,
          SUM(CASE WHEN membership = 'Gold' THEN 1 ELSE 0 END) as gold,
          SUM(CASE WHEN membership = 'Silver' THEN 1 ELSE 0 END) as silver,
          SUM(CASE WHEN membership = 'Platinum' THEN 1 ELSE 0 END) as platinum
        FROM customers
      `);
      
      stmt.step();
      const result = stmt.getAsObject();

      return {
        total: result.total || 0,
        active: result.active || 0,
        inactive: result.inactive || 0,
        families: result.families || 0,
        individuals: result.individuals || 0,
        membershipBreakdown: {
          gold: result.gold || 0,
          silver: result.silver || 0,
          platinum: result.platinum || 0
        }
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        families: 0,
        individuals: 0,
        membershipBreakdown: { gold: 0, silver: 0, platinum: 0 }
      };
    }
  },

  // Search customers with filters
  async searchCustomers(filters: {
    search?: string;
    status?: string;
    familyType?: string;
    salesmanId?: string;
  }): Promise<Customer[]> {
    try {
      await ensureInitialized();
      
      let query = 'SELECT * FROM customers WHERE 1=1';
      const params: any[] = [];

      if (filters.search) {
        query += ' AND (name LIKE ? OR contact LIKE ? OR regId LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.status && filters.status !== 'all') {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.familyType && filters.familyType !== 'all') {
        query += ' AND familyType = ?';
        params.push(filters.familyType);
      }

      if (filters.salesmanId && filters.salesmanId !== 'all') {
        query += ' AND salesmanId = ?';
        params.push(filters.salesmanId);
      }

      query += ' ORDER BY created_at DESC';

      const stmt = db.prepare(query);
      stmt.bind(params);
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      
      return results as Customer[];
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  },

  // Documents
  async addDocument(doc: { id: string; customerId: string; type: string; filename: string; filepath: string }): Promise<boolean> {
    try {
      await ensureInitialized();
      db.run(
        `INSERT INTO documents (id, customerId, type, filename, filepath) VALUES (?, ?, ?, ?, ?)`,
        [doc.id, doc.customerId, doc.type, doc.filename, doc.filepath]
      );
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error adding document:', error);
      return false;
    }
  },

  async listDocuments(customerId: string): Promise<CustomerDocument[]> {
    try {
      await ensureInitialized();
      const stmt = db.prepare('SELECT id, customerId, type, filename, filepath, uploaded_at FROM documents WHERE customerId = ? ORDER BY uploaded_at DESC');
      stmt.bind([customerId]);
      const out: CustomerDocument[] = [] as any;
      while (stmt.step()) {
        const row = stmt.getAsObject();
        out.push({
          id: String(row.id),
          customerId: String(row.customerId),
          type: String(row.type),
          filename: String(row.filename),
          url: `/uploads/${path.basename(String(row.filepath))}`,
          uploadedAt: String(row.uploaded_at)
        });
      }
      return out;
    } catch (error) {
      console.error('Error listing documents:', error);
      return [];
    }
  },

  async deleteDocument(id: string): Promise<boolean> {
    try {
      await ensureInitialized();
      let filepath = '';
      try {
        const stmt = db.prepare('SELECT filepath FROM documents WHERE id = ?');
        stmt.bind([id]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          filepath = String(row.filepath);
        }
      } catch {}
      db.run('DELETE FROM documents WHERE id = ?', [id]);
      if (filepath) {
        try { await fs.unlink(filepath); } catch {}
      }
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  },

  // History
  async addHistory(entry: { id: string; customerId: string; action: string; note?: string }): Promise<boolean> {
    try {
      await ensureInitialized();
      db.run(
        `INSERT INTO customer_history (id, customerId, action, note) VALUES (?, ?, ?, ?)`,
        [entry.id, entry.customerId, entry.action, entry.note || null]
      );
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error adding history entry:', error);
      return false;
    }
  },

  async getHistory(customerId: string): Promise<CustomerHistoryEntry[]> {
    try {
      await ensureInitialized();
      const stmt = db.prepare('SELECT id, customerId, action, note, created_at FROM customer_history WHERE customerId = ? ORDER BY created_at DESC');
      stmt.bind([customerId]);
      const out: CustomerHistoryEntry[] = [] as any;
      while (stmt.step()) {
        const row = stmt.getAsObject();
        out.push({
          id: String(row.id),
          customerId: String(row.customerId),
          action: String(row.action),
          note: row.note != null ? String(row.note) : undefined,
          createdAt: String(row.created_at)
        });
      }
      return out;
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }
};

// Authentication service functions
export const authDB = {
  // Verify admin credentials
  async verifyAdmin(username: string, password: string): Promise<{ success: boolean; admin?: any }> {
    try {
      await ensureInitialized();
      
      const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
      stmt.bind([username]);
      
      if (!stmt.step()) {
        return { success: false };
      }
      
      const admin = stmt.getAsObject();
      const isValid = await bcrypt.compare(password, admin.password_hash);
      
      if (isValid) {
        // Return admin data without password hash
        const { password_hash, ...adminData } = admin;
        return { success: true, admin: adminData };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      return { success: false };
    }
  },

  // Create new admin
  async createAdmin(username: string, password: string): Promise<boolean> {
    try {
      await ensureInitialized();
      
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hashedPassword]);
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error creating admin:', error);
      return false;
    }
  },

  // Update admin password
  async updateAdminPassword(username: string, newPassword: string): Promise<boolean> {
    try {
      await ensureInitialized();

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE admins SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?', [hashedPassword, username]);
      await saveDatabase();
      return true;
    } catch (error) {
      console.error('Error updating admin password:', error);
      return false;
    }
  },

  // Get all admins (for debugging/verification)
  async getAllAdmins(): Promise<any[]> {
    try {
      await ensureInitialized();

      const stmt = db.prepare('SELECT id, username, password_hash, created_at, updated_at FROM admins');
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } catch (error) {
      console.error('Error getting all admins:', error);
      return [];
    }
  }
};

// Initialize database on module load (but don't wait for it)
initializeDatabase().catch(console.error);

console.log('SQLite database service initialized using sql.js');
