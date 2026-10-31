# Blox Fruit Services — Complete Architecture & Implementation Plan

A comprehensive specification and implementation plan incorporating all newly confirmed features: **Customer Support (Website Form + Direct Discord)**, **Staff Support Inbox with manual Discord logging & search**, **Voluntary Roblox Screen-Sharing & Media Evidence**, **Consent-Governed Proofs & Ongoing Services Showcase**, and **Vercel + Neon PostgreSQL deployment**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Product & Feature Decisions**
> 1. **Customer Service (BOTH)**:
>    - Direct Contact: Discord invite banner (`https://discord.gg/placeholder-blox-fruit-services`) displayed across the header, support page, and order confirmation.
>    - Customer Service Page (`/support`): Interactive inquiry form submitting directly to the database.
> 2. **Enquiries & Support Inbox (BOTH)**:
>    - Inquiries stored in PostgreSQL (`enquiries` table) with statuses: `pending`, `in_progress`, `resolved`.
>    - Staff-only Support Inbox inside the Staff Portal (`/admin/enquiries` / dashboard tab).
>    - Ability for staff to manually log external inquiries (e.g. from Discord DMs or ticket bots).
>    - Searchable by Roblox username, order code, or inquiry ID.
> 3. **Roblox Screen-Sharing & Evidence (BOTH)**:
>    - **Live Screen-Sharing Guidelines**: Explicit coordinator tool in orders and support for voluntary Discord screen-sharing where the customer shares **only** their Roblox window. Zero covert recording, background agents, or password/cookie requests.
>    - **Alternative Evidence**: Customer or staff screenshot / video submission for verification.
> 4. **Proofs & Ongoing Services (Consent-Governed)**:
>    - **Proofs Section (`/proofs`)**: Wall of verified completed service proofs.
>    - **Ongoing Services Section (`/ongoing`)**: Live queue of active carries.
>    - **Strict Consent Rule**: Displaying Roblox usernames or evidence publicly requires **explicit customer consent** (checkbox on order/evidence) **AND staff review/approval** before publishing.
> 5. **Deployment Architecture**:
>    - React 19 + Vite 8 frontend + Express API serverless adapter on Vercel (`api/index.ts`).
>    - Neon PostgreSQL via Drizzle ORM (`@neondatabase/serverless` HTTP driver) with automatic local/offline memory fallback for testing.
>    - Safe staff authentication using HTTP-Only cookies (`bfs_staff_session`).

---

## 1. Affected Codebase Files & Impact Analysis

| File / Component | Existing Role | Planned Changes (Preserving Existing Code) |
| :--- | :--- | :--- |
| `src/db/schema.ts` | Drizzle ORM schema for services, orders, items, audit, payments | Add `enquiries` and `serviceEvidence` tables with relations. |
| `src/db/index.ts` | Repository interface & local JSON store | Add repository functions for enquiries (list, search, create, update status) and evidence/proofs (submit, approve, list public). Add Neon Drizzle client with transparent local fallback. |
| `server.ts` | Monolithic Express server | Add API endpoints: `/api/support` (submit enquiry), `/api/proofs` (public proofs), `/api/ongoing` (active carries), `/api/admin/enquiries` (staff inbox & manual logging), `/api/admin/proofs` (staff moderation). Keep local dev runner. |
| `api/index.ts` | *(New)* Vercel Serverless Function entry | Export Express app for Vercel serverless execution. |
| `vercel.json` | *(New)* Deployment config | Configure API routing and SPA rewrites. |
| `src/types/index.ts` | Shared TypeScript types | Add `Enquiry`, `EnquiryInput`, `ServiceEvidence`, `CreateEnquiryPayload`. |
| `src/lib/api.ts` | Frontend API client | Add methods for support submission, staff inbox, proofs, and evidence approval. Remove `localStorage` token storage; use HTTP-only cookies (`credentials: 'include'`). |
| `src/components/Navbar.tsx` | Top navigation bar | Add links to **Support**, **Proofs**, and **Active Carries**; include Discord badge. |
| `src/components/Footer.tsx` | Site footer | Add links to Discord support, Proofs wall, security guarantee (never ask for passwords), and Terms. |
| `src/pages/SupportPage.tsx` | *(New)* Customer service page | Contact options (Discord placeholder banner), web support form, screen-share safety FAQ. |
| `src/pages/ProofsPage.tsx` | *(New)* Proofs showcase | Public showcase of staff-approved, customer-consented completed service evidence. |
| `src/pages/OngoingPage.tsx` | *(New)* Active carries queue | Live transparency board showing active orders in progress (with privacy masking unless consented). |
| `src/pages/admin/AdminDashboardPage.tsx` | Staff management dashboard | Add tabs for **Orders**, **Support Inbox** (with search & manual Discord logging), and **Evidence & Proofs Review**. |
| `src/pages/admin/AdminOrderDetailPage.tsx` | Order detail view | Add section for evidence management, customer consent toggle, and live screen-share coordination notes. |
| `src/pages/OrderFormPage.tsx` | Order checkout | Add optional checkbox: *"I consent to having my carry completion proof (screenshots) displayed on the public Proofs showcase."* |
| `tests/*` | Automated test suite | Add tests for enquiry creation, staff status updates, search filtering, and consent-controlled proofs display. |

---

## 2. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Blox Fruit Services Frontend                          │
├───────────────────┬───────────────────┬───────────────────┬─────────────────────┤
│  Catalog & Orders │  Order Tracking   │  Support & Discord│  Proofs & Ongoing   │
│  (/, /services,   │  (/track/:token)  │  (/support)       │  (/proofs, /ongoing)│
│   /order)         │  50/50 Breakdown  │  Web Form + FAQs  │  Consent-Filtered   │
└─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴──────────┬──────────┘
          │                   │                   │                    │
          ▼                   ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  Express API (server.ts / api/index.ts on Vercel)               │
├───────────────────────────────────────┬─────────────────────────────────────────┤
│  Public Endpoints:                    │  Staff Portal Endpoints (Auth Required):│
│  ├─ GET /api/services                 │  ├─ POST /api/admin/login (HTTP Cookie) │
│  ├─ POST /api/orders                  │  ├─ GET /api/admin/orders               │
│  ├─ GET /api/orders/track/:token      │  ├─ POST /api/admin/orders/:id/payments │
│  ├─ POST /api/support/enquiries       │  ├─ GET /api/admin/enquiries (Search)   │
│  ├─ GET /api/proofs (Public approved) │  ├─ POST /api/admin/enquiries (Manual)  │
│  └─ GET /api/ongoing (Active carries) │  └─ POST /api/admin/proofs/:id/review   │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                       Drizzle ORM + Neon HTTP Driver
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Neon PostgreSQL Database                               │
├───────────────────┬───────────────────┬───────────────────┬─────────────────────┤
│  services         │  orders & items   │  enquiries        │  service_evidence   │
│  Catalog & prices │  Status & Escrow  │  Web & Discord    │  Screenshots/Videos │
│  in hundredths (M)│  50% Invariant    │  Pending/Resolved │  Consent & Approval │
└───────────────────┴───────────────────┴───────────────────┴─────────────────────┘
```

---

## 3. Database Schema Extensions

### `enquiries` Table
```sql
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- 'website' | 'discord' | 'direct'
  customer_name TEXT,
  roblox_username TEXT NOT NULL,
  discord_tag TEXT,
  order_code_or_id TEXT,             -- Optional reference to BFS-XXXX
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'resolved'
  staff_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### `service_evidence` Table
```sql
CREATE TABLE service_evidence (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES services(id),
  evidence_type TEXT NOT NULL,        -- 'screenshot' | 'video_link' | 'screen_share_session'
  media_url TEXT NOT NULL,            -- URL to uploaded image or video link
  notes TEXT,
  customer_consent_public BOOLEAN NOT NULL DEFAULT FALSE,
  staff_approved_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT
);
```

---

## 4. Screen-Sharing & Security Protocol

> [!CAUTION]
> **Roblox Account Safety Rules (Zero Credential Collection)**
> - The application **never** asks for, accepts, or stores Roblox account passwords, `.ROBLOSECURITY` session cookies, 2FA codes, or backup codes.
> - **Live Screen-Sharing Policy**:
>   - Conducted voluntarily over **Discord Screen Share**.
>   - The customer is instructed to share **application window only (Roblox)** rather than their entire desktop, to safeguard personal files.
>   - Staff members never take remote control of the customer's computer or input devices.
> - **Alternative Evidence Submission**:
>   - Customers or staff can upload completion screenshots or unlisted video URLs (YouTube, Streamable, Discord CDN) showing the completed raid/trial/boss clear.

---

## 5. Implementation Checklist

- [ ] **Phase 1: Database & Model Extensions**
  - [ ] Add `enquiries` and `serviceEvidence` tables to `src/db/schema.ts`.
  - [ ] Add TypeScript interfaces to `src/types/index.ts`.
  - [ ] Implement repository functions in `src/db/index.ts` for enquiries and proofs.
  - [ ] Preserve offline/test fallback so `npm test` continues to run with zero external dependencies.

- [ ] **Phase 2: Express API Endpoints**
  - [ ] `POST /api/support/enquiries`: Public support form submission with rate limiting and username validation.
  - [ ] `GET /api/proofs`: Returns list of completed service proofs where `customer_consent_public = true` AND `staff_approved_public = true`.
  - [ ] `GET /api/ongoing`: Returns active in-progress carries (masked usernames unless consented).
  - [ ] `GET /api/admin/enquiries`: Staff endpoint to list/search enquiries by Roblox username or order ID.
  - [ ] `POST /api/admin/enquiries`: Staff endpoint to manually log inquiries received via Discord or external channels.
  - [ ] `PATCH /api/admin/enquiries/:id`: Update enquiry status (`pending`, `in_progress`, `resolved`) and staff response notes.
  - [ ] `POST /api/admin/orders/:id/evidence`: Attach screenshot/video link, toggle customer consent, and approve for public proof.

- [ ] **Phase 3: Customer Service & Public Pages**
  - [ ] Create `SupportPage.tsx` with:
    - Discord direct contact card (with placeholder link).
    - Website inquiry form (Roblox username, Discord tag, order code, subject, message).
    - Screen-sharing guidelines & security FAQ (anti-phishing reminder).
  - [ ] Create `ProofsPage.tsx` with:
    - Filterable gallery of verified completions.
    - Badges for carry types (Leviathan, Dough Awakening, Race V4, etc.).
    - Consent verification indicator.
  - [ ] Create `OngoingPage.tsx` with:
    - Live carry queue showing current stage (`Accepted`, `Deposit Received`, `In Progress`).
  - [ ] Update `Navbar.tsx` and `Footer.tsx` with navigation links to Support, Proofs, and Ongoing Services.
  - [ ] Update `OrderFormPage.tsx` with the customer consent checkbox for public proof sharing.

- [ ] **Phase 4: Staff Portal Enhancements**
  - [ ] Add **Support Inbox** tab in `AdminDashboardPage.tsx`:
    - Filter by status (`pending`, `in_progress`, `resolved`).
    - Search input (Roblox username or Order ID).
    - "Manual Discord Enquiry" modal/form for staff to log external requests.
    - Inline status updater.
  - [ ] Add **Evidence & Screen-Sharing Coordinator** in `AdminOrderDetailPage.tsx`:
    - Upload / link completion evidence.
    - Customer consent indicator & staff publication approval toggle.
    - Discord screen-sharing coordination helper.

- [ ] **Phase 5: Vercel & Neon Configuration**
  - [ ] Add `api/index.ts` exporting the Express app for Vercel serverless runtime.
  - [ ] Add `vercel.json` rewrite configuration.
  - [ ] Harden staff session cookies (HTTP-Only, Secure, `credentials: 'include'`).
  - [ ] Update `.env.example` with clear placeholders.
  - [ ] Provide `DEPLOYMENT.md` guide.

- [ ] **Phase 6: Automated Testing & Verification**
  - [ ] Add unit and integration tests for enquiry submission and status flow.
  - [ ] Add tests for privacy consent filtering on the Proofs and Ongoing endpoints.
  - [ ] Run `npm run lint`, `npm test`, and `npm run build` to verify 100% build health.
