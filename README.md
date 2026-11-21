# FactoryFlow – Order-to-Audit Management System

> **A realistic, production-quality, full-stack enterprise web application designed for a small-scale South Indian packaged food manufacturing business (producing Murukku, Mixture, Chips, and Sweets).**  
> *Developed as an individual internship project for the Centre for Digital Infrastructure, National Institute of Technology, Tiruchirappalli (NIT-T).*

---

## 1. Project Overview

**FactoryFlow** is a complete, genuinely working Order-to-Audit manufacturing execution and accounting system. It connects field sales order capture, administrative order verification and shortage control, Bill of Materials (BOM) recipe planning, batch production execution with material consumption and yield variance tracking, immutable stock ledger management, strict First-In First-Out (FIFO) inventory valuation, statutory GST tax invoicing with PDFKit invoice generation, customer payment tracking with ageing buckets, and certified auditor registers exportable to Excel and CSV.

### Real-World Business Context
The application models a realistic packaged food manufacturing enterprise located in **Tiruchirappalli, Tamil Nadu**, producing traditional savory products such as **Murukku 200 g** and **Madras Mixture 250 g**. The manufacturing workflow involves bulk raw ingredient procurement (rice flour, urad dhal, groundnut/sesame cooking oil, salt and spice blends), food-grade pouch packaging, corrugated carton packing, boiling and frying energy overheads, and dispatch to regional retailers (Tamil Nadu) and interstate distributors (Karnataka).

---

## 2. Technology Stack & Justification

| Layer | Technologies | Architectural Justification |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React, React Router 6, TanStack Query, React Hook Form, Zod, Recharts | Type-safe single-page application with responsive layouts for mobile salesmen and desktop factory administrators. Clean enterprise dashboard styling without decorative bloat. |
| **Backend** | Node.js, Express.js, TypeScript, REST API, JWT Authentication, bcryptjs, Zod validation | Modular layered architecture (Controllers -> Services -> Prisma ORM -> Database). Explicit validation at route boundaries and role-based middleware guards. |
| **Database** | PostgreSQL 16/18, Prisma ORM | Relational schema with ACID transactions, foreign keys, unique constraints, and high-precision `Decimal(12, 2)` / `Decimal(12, 3)` fields for decimal-safe financial and weight calculations. |
| **Document & Export Services** | PDFKit, ExcelJS, CSV generation | Server-side statutory GST Tax Invoice PDF streaming with bilingual/formal format, Excel (.xlsx) workbook generation with styled headers, and standard CSV downloads. |
| **DevOps & Testing** | Git, Docker, Docker Compose, Vitest / Node test runner, Embedded Postgres | Zero-friction local setup on Windows/Linux/Mac with automated tests validating all 18 core requirements and benchmark scenario. |

---

## 3. Implemented Modules & Features

### A. Role-Based Access Control (5 Roles)
1. **SALESMAN (`salesman_a@factoryflow.in`, `salesman_b@factoryflow.in`)**:
   - Mobile-optimized interface for field sales.
   - Restricted strictly to viewing assigned customers and own submitted orders.
   - Live selling price lookup from master database.
   - Instant calculation of line subtotals, 5% estimated GST, and order totals.
2. **ADMIN (`admin@factoryflow.in`)**:
   - Complete verification queue for all incoming customer orders.
   - Real-time stock availability check with automatic **shortage detection** alerts.
   - 1-click Order Approval / Rejection with mandatory rejection reason logging.
   - Generates sequential GST tax invoices (`INV-YYYY-XXXX`).
   - Posts dispatches that atomically reduce finished goods stock in the immutable StockLedger.
   - Prevents dispatching when shortage exists.
   - Records customer payments and manages master data (Customers, Products, Suppliers).
3. **PRODUCTION SUPERVISOR (`supervisor@factoryflow.in`)**:
   - Manages Bill of Materials (BOM) recipes with batch multipliers.
   - Initiates production runs: calculates expected raw material consumption and yield.
   - Records actual material issued, actual good output, damaged pouches scrap, and cartons used.
   - Computes consumption variance % and yield variance %, flagging any variance exceeding the configured **±3% tolerance**.
   - Atomically executes multi-table database transactions (reduces raw stock, reduces packaging, adds finished goods).
4. **ACCOUNTANT & AUDITOR (`auditor@factoryflow.in`)**:
   - Read-only audit access across all financial and inventory registers.
   - Sales Register with customer, HSN, quantity, taxable value, and tax split.
   - Statutory GST Summary mapped directly to **GSTR-1** (B2B Table 4, B2C Table 7, Intra/Interstate) and **GSTR-3B** (Table 3.1 outward tax liability).
   - Purchase Register with supplier GSTINs and inward GST.
   - Customer Outstanding Ageing report segmented into **0–30, 31–60, 61–90, and >90 days** buckets.
   - 1-click export of all registers to Excel (.xlsx) and CSV.
   - Immutable audit trail of all database actions.
5. **OWNER (`owner@factoryflow.in`)**:
   - Executive factory KPI dashboard.
   - Product-wise Cost per Packet, Selling Price, Gross Margin (₹), and Margin %.
   - Interactive charts for product revenues and yield variance trends.
   - Total factory receivables and overdue debt monitoring.

---

## 4. Role Demo Credentials

FactoryFlow includes a **1-click Role Selector** on the login screen for seamless panel evaluation:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@factoryflow.in` | `Admin@123` | Order approvals, GST invoices, dispatches, purchases, payments |
| **Salesman A** | `salesman_a@factoryflow.in` | `Sales@123` | Mobile order entry for Retailer A (Tamil Nadu) |
| **Salesman B** | `salesman_b@factoryflow.in` | `Sales@123` | Mobile order entry for Distributor B (Karnataka) |
| **Production Supervisor** | `supervisor@factoryflow.in` | `Supervisor@123` | BOM batch execution, yield variance, material issues |
| **Accountant / Auditor** | `auditor@factoryflow.in` | `Auditor@123` | Read-only audit registers, GSTR-1/3B, Excel/CSV exports |
| **Owner** | `owner@factoryflow.in` | `Owner@123` | Executive dashboard, packet costing, margins, debt overview |

---

## 5. Mandatory Benchmark Scenario & Verification

The project includes an end-to-end automated script (`npm run benchmark`) executing all 9 benchmark steps with 100% mathematical precision:

### Benchmark Master Setup
- **Product**: Murukku 200 g (Selling price: ₹50/packet, GST: 5%, HSN: 1905).
- **BOM**: 200 expected packets batch = Flour 40 kg, Oil 10 L, Spice mix 1.2 kg, 200g Pouch 200 pcs, Carton 10 pcs.
- **Opening Inventory**: Flour 100 kg (@ ₹42/kg), Cooking oil 30 L (@ ₹140/L), Spice mix 5 kg (@ ₹200/kg), Pouches 500 pcs (@ ₹2.50/pc), Cartons 30 pcs (@ ₹15/pc), Finished Murukku 50 packets.
- **Factory Location**: Tamil Nadu (State Code 33).
- **Customers**: Retailer A (Tamil Nadu, State Code 33) & Distributor B (Karnataka, State Code 29).

### 9-Step Execution & Expected Results

| Step | Action Taken | Formula / Calculation | Verification Result | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | Purchase 60 kg flour @ ₹45/kg | Stock = 100 + 60 | **160 kg** (closing after run: **120 kg**) | **PASS** |
| **2** | Issue materials for 200 pkt batch | Flour 40kg, Oil 10.5L, Spice 1.2kg | Oil consumed: 10.5 L (Variance: **+5%**) | **PASS** |
| **3** | Record actual production output | 188 good pkts, 6 damaged pouches, 9 cartons | Yield variance = ((188 - 200) / 200) * 100 = **-6%** | **PASS** |
| **3** | Finished goods after production | 50 opening + 188 actual output | **238 packets** | **PASS** |
| **4** | Salesman A orders for Retailer A | 150 pkts @ ₹50 | Subtotal: ₹7,500, Estimated GST: ₹375 | **PASS** |
| **5** | Admin approves, invoices & dispatches | Intra-state TN: CGST 2.5% + SGST 2.5% | Total Invoice: **₹7,875** (₹187.50 CGST + ₹187.50 SGST) | **PASS** |
| **5** | Finished goods after Retailer A dispatch | 238 - 150 dispatched | **88 packets** | **PASS** |
| **6** | Salesman B orders for Distributor B | 120 pkts requested, 88 available | Shortage flagged: **32 packets** (Dispatch rejected) | **PASS** |
| **7** | Record payment from Retailer A | ₹4,000 received against invoice | Outstanding balance: ₹7,875 - ₹4,000 = **₹3,875** | **PASS** |
| **8** | Manufacturing Overheads | Labour ₹1,200 + Gas/Power ₹600 | Overheads allocated over 188 good pkts | **PASS** |
| **8** | Cost per good packet | (₹4,010 materials + ₹1,800 overheads) / 188 | **₹30.90 / packet** (Margin: ₹19.10 / 38.20%) | **PASS** |
| **9** | Statutory Reports | GSTR-1 & GSTR-3B tax summary generated | GSTR-3B Outward: ₹7,500, Total Tax: ₹375 | **PASS** |

### Verified Closing Balances Table

```
┌─────────┬────────────────────────────────────────────┬───────────────┬───────────────┬──────┐
│ (index) │ name                                       │ actual        │ expected      │ pass │
├─────────┼────────────────────────────────────────────┼───────────────┼───────────────┼──────┤
│ 0       │ 'Flour closing balance'                    │ '120 kg'      │ '120 kg'      │ true │
│ 1       │ 'Oil closing balance'                      │ '19.5 litres' │ '19.5 litres' │ true │
│ 2       │ 'Spice mix closing balance'                │ '3.8 kg'      │ '3.8 kg'      │ true │
│ 3       │ 'Pouches closing balance'                  │ '306 pieces'  │ '306 pieces'  │ true │
│ 4       │ 'Cartons closing balance'                  │ '21 pieces'   │ '21 pieces'   │ true │
│ 5       │ 'Finished goods after production'          │ '238 packets' │ '238 packets' │ true │
│ 6       │ 'Finished goods after Retailer A dispatch' │ '88 packets'  │ '88 packets'  │ true │
│ 7       │ 'Yield variance'                           │ '-6%'         │ '-6%'         │ true │
│ 8       │ 'Oil consumption variance'                 │ '+5%'         │ '+5%'         │ true │
│ 9       │ 'Retailer A taxable invoice'               │ '₹7500'       │ '₹7500'       │ true │
│ 10      │ 'CGST'                                     │ '₹187.5'      │ '₹187.50'     │ true │
│ 11      │ 'SGST'                                     │ '₹187.5'      │ '₹187.50'     │ true │
│ 12      │ 'Invoice total'                            │ '₹7875'       │ '₹7875'       │ true │
│ 13      │ 'Retailer A payment'                       │ '₹4000'       │ '₹4000'       │ true │
│ 14      │ 'Retailer A outstanding'                   │ '₹3875'       │ '₹3875'       │ true │
│ 15      │ 'Distributor B order shortage'             │ '32 packets'  │ '32 packets'  │ true │
│ 16      │ 'Shortage dispatch prevented'              │ 'Prevented'   │ 'Prevented'   │ true │
└─────────┴────────────────────────────────────────────┴───────────────┴───────────────┴──────┘
```

---

## 6. FIFO Valuation & Costing Method

FactoryFlow implements **strict First-In First-Out (FIFO) inventory valuation layers**:
- Each purchase receipt or opening balance creates an immutable record in `InventoryValuationLayer` tracking `originalQuantity`, `remainingQuantity`, and `unitCost`.
- When a production run consumes raw materials, it queries layers ordered by `receivedDate ASC` where `remainingQuantity > 0`.
- In the benchmark:
  - Opening flour layer: 100 kg @ ₹42/kg.
  - Step 1 purchase: 60 kg @ ₹45/kg.
  - Consuming 40 kg flour for Batch 1 consumes exclusively from the oldest ₹42 layer:  
    `40 kg * ₹42 = ₹1,680`.
  - Remaining in Layer 1: 60 kg @ ₹42. Layer 2 (60 kg @ ₹45) remains intact.
- **Overhead Allocation**:
  - Labour overhead: ₹1,200.
  - Gas/power overhead: ₹600.
  - Total overheads: ₹1,800.
  - Overheads are allocated across actual good output (188 packets), NOT planned batch size:  
    `Overhead per packet = ₹1,800 / 188 = ₹9.574 / pkt`.
  - Total unit cost = `₹30.90 / packet`.
  - Selling price = `₹50.00 / packet`.
  - Gross profit margin = `₹19.10 / packet` (**38.20% margin**).

---

## 7. How to Run Locally

### Prerequisites
- Node.js >= 18.x (tested on Node v24.19.0)
- npm >= 9.x

### Quick Start (Single Command / Step-by-Step)

#### 1. Setup Backend
```bash
cd server
npm install
npm run db:push     # Synchronizes PostgreSQL schema
npm run benchmark   # Seeds benchmark data and runs all 9 steps
npm start           # Starts API server on http://localhost:5000
```

#### 2. Setup Frontend (Development Mode)
```bash
cd client
npm install
npm run dev         # Starts Vite dev server on http://localhost:3000
```
Open **`http://localhost:3000`** in any browser.

#### 3. Single-Port Production Mode
The Express server on port 5000 automatically serves the compiled React production build (`client/dist`):
```bash
# In client:
npm run build
# In server:
npm start
```
Open **`http://localhost:5000`** in your browser.

---

## 8. Running Automated Tests

Run the comprehensive test suite validating all 18 mandatory items:
```bash
cd server
npm test
```
All 18 automated tests pass with 0 failures:
- 1. Flour stock calculation (100 + 60 - 40 = 120 kg)
- 2. Oil stock calculation (30 - 10.5 = 19.5 litres)
- 3. Packaging stock calculation (306 pouches, 21 cartons)
- 4. Finished-goods stock calculation (50 + 188 - 150 = 88 packets)
- 5. BOM planned consumption formula correctness
- 6. Unit conversions service
- 7. Consumption variance calculation and tolerance flag (+5%)
- 8. Yield variance calculation and tolerance flag (-6%)
- 9. CGST and SGST calculation (Tamil Nadu 2.5% + 2.5%)
- 10. IGST calculation for Inter-state Karnataka transaction (5% IGST)
- 11. Invoice total (₹7,500 + ₹187.50 + ₹187.50 = ₹7,875)
- 12. Payment and outstanding calculation (₹7,875 - ₹4,000 = ₹3,875)
- 13. FIFO inventory valuation layers (40 kg consumed from ₹42 layer)
- 14. Cost per good packet (₹5,810 total cost / 188 good pkts = ₹30.90)
- 15. Insufficient stock prevention rejects dispatch when shortage exists
- 16. Role-based authorization checks exist for all 5 roles
- 17. Prevention of duplicate transaction posting
- 18. Transaction rollback when production posting fails

---

## 9. Docker Deployment

To launch the full production stack using Docker Compose:
```bash
docker-compose up --build -d
```
This boots:
1. `postgres:16-alpine` on port 5432 with persistent volume.
2. `factoryflow-backend` on port 5000 with auto-migrations.
3. `factoryflow-frontend` on port 80 powered by Nginx reverse proxy.

---

## 10. Internship Evaluation Notes

- **Centre**: Centre for Digital Infrastructure, National Institute of Technology, Tiruchirappalli.
- **Application**: FactoryFlow – Order-to-Audit Factory Management System.
- **Demonstration**: Run `npm run benchmark` to observe the benchmark scenario in console, then log in via web UI using the top navigation bar's role switcher to demonstrate each role's view.
