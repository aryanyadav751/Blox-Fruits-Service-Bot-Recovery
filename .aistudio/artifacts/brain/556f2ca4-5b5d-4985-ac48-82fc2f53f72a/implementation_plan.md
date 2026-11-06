# Blox Fruits Dynamic Value Research System — Implementation Plan

## 1. Best Supported Google Search Integration
- **Model & SDK**: `@google/genai` (v2.32.0+) using model `gemini-3.8-flash`.
- **Search Grounding Tool**: `config: { tools: [{ googleSearch: {} }] }` running entirely server-side in `server.ts`.
- **Grounding Metadata Extraction**: Extract verified citations, URLs (`groundingChunks[].web.uri`), page titles (`groundingChunks[].web.title`), and search queries from `response.candidates[0].groundingMetadata`.
- **Structured Extraction**: Prompt the model to extract and return structured items with reported values in millions (M), source domain/names, and trade notes.

## 2. API Requirements & Cost Assessment
- **Gemini 3.8 Flash Free Tier**:
  - Gemini 3.8 Flash includes a generous free-tier allocation for basic queries.
  - Search grounding requests on the free tier provide live search grounding up to standard rate limits (15 RPM / 1M TPM).
  - No paid API key or billing required for standard usage. If higher throughput is needed, users can configure a billing-enabled key in AI Studio **Settings > Secrets**.
  - Rate limiting & batching: Research processes items in targeted batches with delay to avoid 429 throttling.

## 3. Value Extraction, Verification & Conflict Detection
- **Multi-Source Cross-Check**: Collect reported values across multiple web sources (e.g. Blox Fruits Values, Fandom Wiki, GamerGuru, FruityBlox, Traderie).
- **Statistical Comparison**:
  - Calculate median / consensus researched value in M.
  - Compute percentage difference vs current catalogue value: `abs(researched - current) / current * 100%`.
  - Discrepancy flagging: If source values diverge by >15%, mark status as `conflict` and confidence as `low`/`conflict` for mandatory admin manual review.
- **Admin Approval Gate (Strict Invariant)**:
  - Customers NEVER see unverified research values.
  - Only when an authenticated admin clicks **Approve** is the official catalogue (`services.price_hundredths` and `services.price_m`) updated and published in Neon PostgreSQL.
  - Admins can edit the proposed value before approving or reject the researched value.
  - Audit trail logs all approvals and value history changes.

## 4. Files to Create or Modify
1. `src/db/schema.ts` — Add `researchResults`, `researchSources`, and `valueHistory` tables.
2. `src/db/neon.ts` — Add DDL statements to `NEON_SCHEMA_DDL` and index definitions.
3. `src/db/index.ts` — Add repository methods for saving research, fetching research items, approving/rejecting, recording value history, and fallback local store handling.
4. `src/types/index.ts` — Add TypeScript types for `ResearchResult`, `ResearchSource`, `ValueHistoryItem`, and `ResearchConfig`.
5. `src/lib/valueResearcher.ts` (or `server.ts` integration) — Server-side Gemini Search Grounding logic, prompt engineering, multi-source parser, and scheduled background task runner.
6. `server.ts` — Admin API endpoints for research (`POST /api/admin/research/run`, `GET /api/admin/research`, `POST /api/admin/research/:id/approve`, `POST /api/admin/research/:id/reject`, `PUT /api/admin/research/:id/edit`, `GET /api/admin/research/history`, `POST /api/admin/research/schedule`).
7. `src/lib/api.ts` — Client methods for research APIs.
8. `src/pages/admin/AdminDashboardPage.tsx` — Add "Live Value Research" tab, research controls, conflict badges, source inspection modal, and approve/reject actions.
9. `src/pages/CatalogPage.tsx` & `src/pages/OrderFormPage.tsx` — Display "Last Market Verification: [Date]" badge for approved prices.
10. `tests/value_research.test.ts` — Comprehensive automated test suite for search extraction, conflict detection, admin approval gate, and audit logging.
