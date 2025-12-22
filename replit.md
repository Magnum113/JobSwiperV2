# JobSwipe - Tinder-Style Job Application Platform

## Overview

JobSwipe is a modern job search application that brings the familiar swipe-based interface to job hunting. Users can swipe through job vacancies, manage their resume, search for specific positions, and view their application history. The platform integrates with HH.ru for real job applications and uses AI-powered cover letter generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, configured with custom plugins for Replit integration
- **Client-side routing** via React state management (no router library currently used)

**UI & Styling**
- **Shadcn UI** component library with Radix UI primitives for accessible, customizable components
- **Tailwind CSS** (v4 inline syntax) for utility-first styling with custom theme configuration
- **Framer Motion** for swipe animations and gesture-based interactions on the vacancy cards
- **Plus Jakarta Sans** as the primary font family

**State Management**
- **TanStack Query (React Query)** for server state management, data fetching, and caching
- Local React state for UI interactions and tab navigation
- UserId stored in localStorage for persistent authentication

**Application Structure**
- **Tab-based navigation** with three main sections:
  - Vacancies (main Tinder-style swipe interface)
  - History (application history with cover letters)
  - Profile (HH.ru OAuth login, resume sync, manual resume)
- Component organization follows feature-based structure in `/client/src/pages`
- Reusable UI components in `/client/src/components/ui`

### Backend Architecture

**Framework**
- **Express.js** REST API server with TypeScript
- **Node.js** runtime with ES modules enabled
- Custom middleware for JSON parsing, logging, and request tracking

**API Design**
- RESTful endpoints for jobs, swipes, resumes, and applications

**HH.ru Integration Endpoints:**
- `/api/hh/jobs` - Fetches real vacancies from HeadHunter API with batch pagination
- `/auth/hh/start` - Initiates OAuth flow, redirects to HH.ru
- `/auth/hh/callback` - OAuth callback, exchanges code for tokens, creates/updates user
- `/api/auth/status` - Returns authentication status and user info
- `/api/hh/resumes/sync` - Syncs user's resumes from HH.ru
- `/api/hh/resumes` - Gets user's synced resumes
- `/api/hh/resumes/select` - Selects active resume for applications
- `/api/hh/apply` - Submits real job application via HH.ru API
- `/api/hh/applications` - Gets user's HH.ru applications

**Local Endpoints:**
- `/api/jobs/unswiped` - Fetches local jobs not yet swiped (fallback/seed data)
- `/api/resume` - GET/POST endpoints for manual resume management
- `/api/applications` - Local application history tracking
- `/api/cover-letter/generate` - AI-powered cover letter generation using OpenRouter (GPT-4.1-mini)

**Server Organization**
- `/server/routes.ts` - Centralized route registration
- `/server/hhAuth.ts` - HH.ru OAuth module (token exchange, refresh, resume API, apply API)
- `/server/storage.ts` - Database abstraction layer (IStorage interface)
- `/server/openrouter.ts` - OpenRouter API integration for AI cover letters (GPT-4.1-mini model)
- `/server/static.ts` - Static file serving for production builds

### Data Layer

**Database**
- **PostgreSQL** as the primary database
- **Drizzle ORM** for type-safe database queries and schema management
- Schema location: `/shared/schema.ts` (shared between client and server)

**Schema Design**
- `users` table: User accounts with HH.ru OAuth tokens
  - `id` (varchar UUID) - Primary key
  - `username`, `password` - Local auth
  - `hh_user_id` - HH.ru user ID
  - `hh_access_token`, `hh_refresh_token`, `hh_token_expires_at` - OAuth tokens
  - `email`, `first_name`, `last_name` - Profile info from HH.ru
- `jobs` table: Stores job vacancies (seed data)
- `swipes` table: Records user swipe actions with persistent filtering
  - `id` (serial) - Primary key
  - `user_id` (varchar FK → users.id) - User who swiped
  - `vacancy_id` (text) - HH.ru vacancy ID (string format)
  - `direction` (text) - "left" or "right"
  - `created_at` (timestamp) - When the swipe occurred
- `resumes` table: User resumes (both synced from HH.ru and manual)
  - `user_id` - References users
  - `hh_resume_id` - HH.ru resume ID (null for manual resumes)
  - `title`, `content`, `content_json` - Resume content
  - `selected` - Active resume for applications
- `applications` table: Tracks job applications
  - `user_id` - References users
  - `vacancy_id` - HH.ru vacancy ID
  - `hh_negotiation_id` - HH.ru negotiation ID (for real applications)
  - `status` - success/failed/demo
  - `error_reason` - Error message if application failed
- `ai_compatibility` table: Caches AI-calculated compatibility scores
  - `user_id` - References users
  - `vacancy_id` - HH.ru vacancy ID
  - `score` - Compatibility score (0-100)
  - `color` - Badge color ("green", "yellow", "red")
  - `explanation` - AI-generated explanation in Russian
  - `created_at` - Timestamp for cache invalidation

### HH.ru OAuth Integration

**OAuth Flow:**
1. User clicks "Войти через hh.ru" on Profile page
2. Redirect to `/auth/hh/start` -> HH.ru authorization page
3. User authorizes, HH.ru redirects to `/auth/hh/callback?code=...`
4. Server exchanges code for access/refresh tokens
5. Fetches user info from HH.ru API
6. Creates/updates user record with tokens
7. Redirects to `/?userId=...&hhAuth=success`
8. Frontend stores userId in localStorage

**Token Refresh:**
- `getValidAccessToken()` in hhAuth.ts checks token expiry
- Automatically refreshes token if expired using refresh_token
- Updates tokens in database

**Resume Sync:**
- Fetches all resumes from HH.ru `/resumes/mine`
- For each resume, fetches full details
- Converts to text format for AI cover letter generation
- Stores in local database with HH.ru resume ID

**Real Applications:**
- When user swipes right (if authenticated):
  1. Generate cover letter using AI
  2. POST to HH.ru `/negotiations` API
  3. Store application record locally with hh_negotiation_id
  4. Show success/error toast

### External Dependencies

**AI Integration**
- **OpenRouter API** for cover letter generation and compatibility scoring
  - Model for cover letters: `openai/gpt-4.1-mini`
  - Model for compatibility: `openai/gpt-4o-mini` (faster, cheaper)
  - API key stored in Replit Secrets as `OPENROUTER_API_KEY`
  - Generates contextual cover letters based on resume and job description
  - Calculates compatibility scores (0-100) with explanation for each vacancy

**HH.ru API**
- OAuth 2.0 for authentication
- Client credentials stored as `HH_CLIENT_ID` and `HH_CLIENT_SECRET`
- Used for: vacancy search, resume sync, job applications

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENROUTER_API_KEY` - OpenRouter API key
- `HH_CLIENT_ID` - HH.ru OAuth Client ID
- `HH_CLIENT_SECRET` - HH.ru OAuth Client Secret
- `SESSION_SECRET` - Session encryption key

**Development & Build**
- **TSX** for TypeScript execution in development
- **esbuild** for fast server-side bundling
- **Drizzle Kit** for database schema management

**Font & Icon Libraries**
- **Google Fonts** (Plus Jakarta Sans) loaded via CDN
- **Lucide React** for consistent icon system throughout the UI

## Recent Changes

- **2025-12-11**: Added AI Compatibility scoring to vacancy cards
  - **Backend**: `POST /api/ai-compatibility/calc` endpoint calculates compatibility scores
  - **Model**: Uses `openai/gpt-4o-mini` via OpenRouter (faster and cheaper than GPT-4.1-mini)
  - **UI**: Sparkle badge in top-left corner of vacancy cards showing score (0-100)
  - **Colors**: Green (70+), Yellow (40-69), Red (0-39)
  - **Tooltip**: Shows AI explanation when hovering over the badge
  - **Caching**: Scores are cached in `ai_compatibility` table to avoid recalculation
  - **Race Protection**: Search token prevents stale compatibility data from overwriting current results
  - **Storage Methods**: `getCompatibility()`, `saveCompatibility()`, `deleteCompatibility()`

- **2025-12-11**: Fixed generateCoverLetter is not defined error
  - **Root Cause**: Removed conflicting `server/gemini.ts` file that exported duplicate `generateCoverLetter` function
  - **Resolution**: Now using only `server/openrouter.ts` for AI cover letter generation (GPT-4.1-mini via OpenRouter)
  - **Verified**: Both `/api/cover-letter/generate` and `/api/apply/async` endpoints work correctly in production build

- **2025-12-08**: Multi-region filter for vacancies
  - **New Endpoint**: `/api/hh/areas` fetches all HH.ru regions with 1-hour cache
  - **Multiple Regions**: Filter now supports selecting multiple regions simultaneously
  - **Popover UI**: Region filter changed from Select to Popover with checkboxes
  - **Region Search**: Search input to filter regions in the popover
  - **Visual Badges**: Selected regions shown as removable badges below the filter
  - **Auto-Search**: Selecting/deselecting regions auto-triggers new vacancy search
  - **Backend Support**: `/api/hh/jobs` now accepts multiple `area` params (`area=1&area=2`)
  - **Default Fallback**: If all regions deselected, defaults to Moscow (id=1)

- **2025-12-07**: GigaChat integration improvements
  - **Undici Agent**: Replaced require("undici").Agent with proper imported Agent class
  - **Both Certificates**: Now loads both russian_trusted_root_ca_pem.crt and russian_trusted_sub_ca_pem.crt
  - **Test Endpoint**: New `/api/test-gigachat` endpoint to verify GigaChat connectivity
  - **Build Script**: `script/build.ts` copies `server/certs/*` to `dist/certs/` during build
  - **ESM/CJS Compatibility**: All server files use `__dirnameResolved` pattern for both ESM (dev) and CJS (production)
  - **Status Translations**: Application statuses translated to Russian (В ожидании, Отправлено, Ошибка, Демо)
  - **Pending Count API**: New `/api/applications/pending-count` endpoint with status filtering (pending/queued only)

- **2025-12-07**: UI improvements and pending applications badge
  - **Modern Loader**: New centered loader with double-ring animation, dark/light theme support
  - **Loader Component**: `client/src/components/ui/loader.tsx` with CenteredLoader, FullPageLoader variants
  - **Badge Counter**: Green (#22C55E) iOS-style notification badge on History tab icon using React Query
  - **Toast Removed**: Removed "Отклик в очереди" toast notification

- **2025-12-06**: Implemented persistent swipe tracking
  - **Schema Update**: `swipes` table now uses `user_id` (varchar FK) and `vacancy_id` (text) instead of old `job_id` integer
  - **Backend Filtering**: `/api/hh/jobs` accepts `userId` parameter and filters out already-swiped vacancies
  - **Swipe Recording**: POST `/api/swipes` records {userId, vacancyId, direction} with duplicate check
  - **Storage Methods**: `getSwipedVacancyIds(userId)`, `hasSwipedVacancy(userId, vacancyId)` for efficient filtering
  - **Frontend Integration**: Swipes are recorded to backend on every swipe (fire-and-forget for instant UI)
  - **Guarantee**: Swiped vacancies will never appear again, even after page reload or returning later

- **2025-12-06**: Added mandatory HH.ru authorization and personalized job search
  - **Auth Screen**: New users see authorization screen on Vacancies tab instead of job cards
  - **Personalized Jobs**: Vacancies are loaded based on user's profession from resume
  - **Profession Extraction**: `extractProfession()` function extracts specialty from resume title/experience
  - **GET /api/user/profession**: Endpoint returns user's profession from selected resume
  - **Auto-Update**: When user syncs resumes or selects different resume, vacancies reload with new profession
  - **OAuth Redirect**: After auth, user is redirected to vacancies page (/) with personalized jobs
  
- **2025-12-06**: Made applications fully user-scoped
  - **Storage Method**: Added `getApplicationsByUser(userId)` for user-specific filtering
  - **Backend Route**: GET `/api/applications` now requires `userId` parameter
  - **Frontend Update**: HistoryPage fetches applications with userId from localStorage
  - **Auth Prompt**: Shows login button if user is not authenticated on History page
  - **Multi-User Support**: Each user only sees their own application history

- **2025-12-06**: Added full HH.ru OAuth integration
  - OAuth login flow with token storage and refresh
  - Resume syncing from HH.ru (automatic after auth)
  - Real job applications via HH.ru API
  - Profile page with HH.ru connection status
  - VacanciesPage shows "hh.ru" indicator when authenticated
  - Async application processing (non-blocking UI)
