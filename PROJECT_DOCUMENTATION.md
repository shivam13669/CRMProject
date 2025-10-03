# HealthCare CRM – Project Documentation (Current)

Prepared by: Team | Scope: Customer + Lead Management, Salesmen Analytics, Reporting

## 1) Overview
A production-ready full‑stack CRM to manage customers, leads, and salesmen analytics. React (SPA) + Express run together via Vite. Data is stored locally using sql.js (SQLite in a file). JWT auth with two roles: central and admin. The app supports CSV/XLSX exports, charts, a custom report builder, and a per‑salesman detailed analytics page.

Live sections:
- Dashboard: high‑level stats
- Upload Data: bulk customer import
- Customers: CRUD, filters, documents, history
- Leads: lifecycle and conversion to customers
- Salesmen: analytics, performance %, salary vs performance, distribution
- Salesman Details: deep‑dive per salesman with filters and export
- Reports: summary, monthly trends, custom report builder
- Admin Users (central only): manage admins

## 2) Tech Stack
- Frontend: React 18, React Router 6, TypeScript, Vite, TailwindCSS, Radix UI, Recharts
- Backend: Express 5, TypeScript, integrated with Vite dev server
- Data: sql.js (SQLite persisted to customer_management.db), local file uploads under /uploads
- Auth: JWT (server signs/validates), role stored in token
- Testing/Tooling: Vitest, Prettier, date-fns, zod (available), html-to-image, xlsx, papaparse

## 3) Project Structure (key paths)
- client/App.tsx: Router and providers
- client/pages/: SPA pages (Dashboard, Customers, Leads, Salesmen, SalesmanDetail, Reports)
- client/components/ui/: UI primitives (Button, Card, Sidebar, etc.)
- client/contexts/: AuthContext, CustomerContext, LeadContext
- server/index.ts: Express setup + routes
- server/routes/: auth, customers, leads, demo
- server/database/db.ts: sql.js DB + customer/doc/history APIs
- shared/api.ts: shared types

## 4) Setup & Commands
- pnpm dev – run client+server with hot reload
- pnpm build – build client and server
- pnpm start – run production build
- pnpm typecheck – TypeScript validation
- pnpm test – Vitest

Environment: JWT_SECRET is optional (defaults to a dev key). Do not commit real secrets.

## 5) Authentication & RBAC
- Login: POST /api/auth/login -> { token, admin }
- Token is stored in localStorage under healthcare_crm_token.
- Middleware server/middleware/auth.ts validates the Bearer token for protected routes.
- Roles: central and admin
  - central: full access + Admin Users page
  - admin: full application access except central-only admin management

## 6) Data Model (runtime DB)
Customer
- id, regId, name, contact, salesmanId, status ('Active'|'Inactive'), familyType ('Family'|'Individual'),
  familyMembers, joinDate, expireDate?, membership ('Gold'|'Silver'|'Platinum'), notes?, tags[]?, created_at, updated_at

CustomerDocument (one per customer enforced server‑side)
- id, customerId, type ('Aadhaar'|'Aadhar'|'PAN'|'Other'), filename, url(/uploads/*), uploadedAt

CustomerHistory
- id, customerId, action, note?, createdAt

Lead
- id, name, contact, source?, status ('New'|'Contacted'|'Qualified'|'Converted'|'Lost'), priority?, score?, assignedTo?, notes?, tags[]?, nextActionAt?, createdAt?, updatedAt?, linkedCustomerId?

LeadHistory
- id, leadId, action, note?, createdAt

## 7) Validations & Normalization
- Contact normalized client‑side (utils/phone.ts). Expect 10–13 digits; UI displays formatted.
- regId unique; server prevents duplicates.
- File upload: one document per customer; server rejects re‑upload until delete.
- Expiry: Effective status uses expireDate or computed expiry (utils/dateUtils.ts); expired -> Inactive for UI stats.

## 8) Features
### 8.1 Customers
- Search by name/contact/regId; filters by status, type, and salesman; pagination.
- CRUD with modals; family members modal; delete single/selected/all.
- Documents: upload (base64) + delete; server stores file under /uploads and metadata in DB.
- History: list/add entries per customer.
- Export CSV/XLSX of current filtered view.

### 8.2 Leads
- List with filters (status, source, assignedTo).
- Create, edit, delete leads; history per lead.
- Convert lead -> creates customer, marks lead Converted, writes history on both.

### 8.3 Salesmen (client/pages/Salesmen.tsx)
- KPIs: Total Salesmen, Total Customers, Active Customers, Average Salary.
- Customer Distribution pie.
- Salary vs Performance chart (Recharts) with tooltips.
- Performance Table with rank, customers, conversion, salary, and Performance %.
- Export Report: XLSX with rows and chart images (pie/bar) captured via html-to-image.

Performance percent rules currently implemented:
- assignedTotal = sum of totalCustomers for all salesmen except Unassigned/unassigned (case‑insensitive).
- For each assigned salesman: Performance = (salesman.totalCustomers / assignedTotal) × 100, rendered as XX.XX/100.
- For Unassigned: if unassignedTotal > 0, Performance = 100/100; otherwise "-".
- Tooltips in the Salary vs Performance chart use the same formula and never show currency for performance.

Salary formula (per salesman):
- BASE 15000 + 500×Active + 250×Family + 150×Individual + 3000×ConversionRate
- conversionRate = activeCustomers / totalCustomers (0–1).

### 8.4 Salesman Detail Page (client/pages/SalesmanDetail.tsx)
- Route: /salesmen/:id (linked via "View Details" in table; Unassigned shows N/A).
- Filters: month range (From/To, inclusive), selectable chart sections for export.
- KPIs: Total, Active, Inactive, Performance share (same % rules as Salesmen page).
- Charts: Active vs Inactive pie, Family vs Individual pie, Monthly additions bar (month of joinDate).
- Customers table for the selected salesman in range.
- Export: XLSX with Summary sheet and embedded chart images (png) per selected sections.

### 8.5 Reports (client/pages/Reports.tsx)
- Customer Summary export.
- Monthly Enrollment export.
- Custom Report Builder: date range, status/type/salesman filters, export as CSV/XLSX/PDF.
- Quick exports: All Customers CSV, Analytics Summary, Monthly Trends.

## 9) Imports / Uploads
- Bulk upload: POST /api/customers/bulk accepts array; server validates and persists; partial success supported with per‑row errors returned.
- Max JSON payload size: 25 MB (server/index.ts JSON limits).
- Documents: POST /api/customers/:id/documents with base64; server enforces single document per customer; DELETE to replace.

## 10) API Reference (protected unless noted)
Auth
- POST /api/auth/login (public)
- POST /api/auth/logout
- GET /api/auth/profile
- POST /api/auth/change-password
- Admin (central only): GET/POST/PATCH/DELETE under /api/auth/admins

Customers
- GET /api/customers?search=&status=&familyType=&salesmanId=
- GET /api/customers/:id
- POST /api/customers
- POST /api/customers/bulk
- PUT /api/customers/:id
- DELETE /api/customers/:id
- DELETE /api/customers (body { ids: string[] })
- DELETE /api/customers/all/clear
- GET /api/customers/:id/documents
- POST /api/customers/:id/documents { filename, type, contentBase64 }
- DELETE /api/customers/:id/documents/:docId or /api/customers/documents/:docId
- GET /api/customers/:id/history
- POST /api/customers/:id/history { action, note? }

Stats/Export
- GET /api/stats/summary
- GET /api/export (raw customers for export)

Leads
- GET /api/leads?search=&status=&source=&assignedTo=
- POST /api/leads
- PUT /api/leads/:id
- DELETE /api/leads/:id
- GET /api/leads/:id/history
- POST /api/leads/:id/history { action, note? }
- POST /api/leads/:id/convert { membership?, familyType?, salesmanId? }

## 11) UI Navigation & Shortcuts
- Sidebar links: Dashboard, Salesmen, Upload Data, Customers, Leads, Reports (+ Admin Users for central).
- Header avatar menu: sign out, admin users (central).
- Tables support selection and bulk actions where applicable.

## 12) Security
- JWT with 24h expiry; middleware denies missing/invalid tokens.
- File uploads written to /uploads and served statically; single document per customer to reduce surface area.
- No secrets logged; default JWT secret exists for dev, set JWT_SECRET in production.

## 13) Error Handling & Limits
- All API responses return { success, data?, message? }.
- Large operations guarded by Express body size limits (25 MB).
- Server returns detailed errors for bulk import and document conflicts.

## 14) Testing
- Unit: utils (date, phone), calculations (where applicable).
- Run: pnpm test (Vitest).
- Type checks: pnpm typecheck.

## 15) Deployment
Prefer Netlify or Vercel via MCP integrations:
- Netlify: connect and deploy; builds run on provider. Optionally verify pnpm build locally.
- Vercel: connect and deploy; auto‑detect build.
Open Preview shares a non‑production link if needed.

## 16) Examples & Notes
- Performance % example: If total customers = 104, with Unassigned = 2 => assignedTotal = 102. MLSM0A0001 with 87 -> 87/102×100 = 85.29/100. MLSM0A0003 with 15 -> 14.70/100. Unassigned row -> 100/100 when unassignedTotal > 0.
- Salary vs Performance tooltip shows currency only for Salary bar; Performance shows XX.XX/100.

## 17) Maintenance Pointers
- Add pages under client/pages and register routes in client/App.tsx.
- Keep UI patterns consistent using components in client/components/ui.
- Database schema evolves in server/database/db.ts (PRAGMA checks add missing columns).
- Never commit real secrets; keep uploads small and sanitized.
