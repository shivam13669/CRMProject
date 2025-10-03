import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleLogout, handleProfile, handleChangePassword, handleViewAdmins, handleCreateAdmin, handleSuspendAdmin, handleUnsuspendAdmin, handleDeleteAdmin, handleUpdateAdmin } from "./routes/auth";
import { authenticateToken } from "./middleware/auth";
import {
  getCustomers,
  getCustomerById,
  addCustomer,
  addCustomers,
  updateCustomer,
  deleteCustomer,
  deleteCustomers,
  clearAllCustomers,
  getCustomerStats,
  listCustomerDocuments,
  uploadCustomerDocument,
  deleteCustomerDocument,
  getCustomerHistory,
  addCustomerHistory
} from "./routes/customers";
import { customerDB } from "./database/db";
import { listLeads, addLead as addLeadRoute, updateLead as updateLeadRoute, deleteLead as deleteLeadRoute, getLeadHistory, addLeadHistory, convertLead } from "./routes/leads";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  // Serve uploaded documents
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Health check endpoints
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Authentication routes
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", authenticateToken, handleLogout);
  app.get("/api/auth/profile", authenticateToken, handleProfile);
  app.post("/api/auth/change-password", authenticateToken, handleChangePassword);

  // Admin management routes (central-only)
  app.get("/api/auth/admins", authenticateToken, handleViewAdmins);
  app.post("/api/auth/admins", authenticateToken, handleCreateAdmin);
  app.post("/api/auth/admins/:id/suspend", authenticateToken, handleSuspendAdmin);
  app.post("/api/auth/admins/:id/unsuspend", authenticateToken, handleUnsuspendAdmin);
  app.delete("/api/auth/admins/:id", authenticateToken, handleDeleteAdmin);
  app.patch("/api/auth/admins/:id", authenticateToken, handleUpdateAdmin);

  // Protected routes (require authentication)
  // Customer statistics (using real database data)
  app.get("/api/stats/summary", authenticateToken, getCustomerStats);

  app.get("/api/stats/trends", authenticateToken, (_req, res) => {
    // TODO: Implement actual database queries for trends
    res.json({
      success: true,
      data: [
        { month: 'Jan', enrollments: 87 },
        { month: 'Feb', enrollments: 124 },
        { month: 'Mar', enrollments: 156 },
        { month: 'Apr', enrollments: 132 },
        { month: 'May', enrollments: 198 },
        { month: 'Jun', enrollments: 234 },
      ]
    });
  });

  // Customer CRUD operations
  app.get("/api/customers", authenticateToken, getCustomers);
  app.get("/api/customers/:id", authenticateToken, getCustomerById);
  app.post("/api/customers", authenticateToken, addCustomer);
  app.post("/api/customers/bulk", authenticateToken, addCustomers);
  app.put("/api/customers/:id", authenticateToken, updateCustomer);
  app.delete("/api/customers/:id", authenticateToken, deleteCustomer);
  app.delete("/api/customers", authenticateToken, deleteCustomers);
  app.delete("/api/customers/all/clear", authenticateToken, clearAllCustomers);

  // File upload endpoint (now handled by bulk customer creation)
  app.post("/api/upload", authenticateToken, addCustomers);

  // Customer documents
  app.get("/api/customers/:id/documents", authenticateToken, listCustomerDocuments);
  app.post("/api/customers/:id/documents", authenticateToken, uploadCustomerDocument);
  app.delete("/api/customers/:id/documents/:docId", authenticateToken, deleteCustomerDocument);
  // Also allow deletion by doc id only
  app.delete("/api/customers/documents/:docId", authenticateToken, deleteCustomerDocument);

  // Customer history
  app.get("/api/customers/:id/history", authenticateToken, getCustomerHistory);
  app.post("/api/customers/:id/history", authenticateToken, addCustomerHistory);

  // Leads
  app.get('/api/leads', authenticateToken, listLeads);
  app.post('/api/leads', authenticateToken, addLeadRoute);
  app.put('/api/leads/:id', authenticateToken, updateLeadRoute);
  app.delete('/api/leads/:id', authenticateToken, deleteLeadRoute);
  app.get('/api/leads/:id/history', authenticateToken, getLeadHistory);
  app.post('/api/leads/:id/history', authenticateToken, addLeadHistory);
  app.post('/api/leads/:id/convert', authenticateToken, convertLead);

  app.get("/api/export", authenticateToken, async (_req, res) => {
    try {
      const customers = await customerDB.getAllCustomers();
      res.json({
        success: true,
        data: customers,
        total: customers.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to export data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return app;
}
