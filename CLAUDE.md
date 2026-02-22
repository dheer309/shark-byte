# CLAUDE.md — UniTap Project Context

## What is UniTap?

UniTap is an NFC-powered campus infrastructure platform built for HackLondon 2025. It uses a single hardware device (ESP32 + NFC reader) deployed across a university campus to handle multiple use cases: lecture attendance, equipment/inventory management, and society event check-ins. Students use their existing Mifare Classic NFC-enabled university ID cards — one tap on any UniTap device triggers a context-dependent action.

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Routing:** react-router-dom v6 (file-based routes in `src/pages/`)
- **Styling:** Inline styles using design tokens from `src/styles/theme.ts` (NO CSS modules, NO Tailwind, NO styled-components)
- **Fonts:** IBM Plex Mono (monospace/data), Instrument Sans (headings/body) — loaded via Google Fonts in `global.css`
- **No component library** — everything is custom

### Backend
- **Framework:** Flask (Python)
- **Database:** MongoDB (use pymongo or Flask-PyMongo)
- **Real-time:** Server-Sent Events (SSE) for live dashboard updates
- **Auth:** JWT tokens, stored in localStorage on frontend

### Hardware (not in this repo)
- ESP32-S3 microcontroller
- PN532 NFC reader module
- 0.96" OLED display
- The ESP32 hits `POST /api/tap` with `{ device_id, card_uid }` over WiFi

## Design System

**CRITICAL: Follow the existing aesthetic exactly. Do NOT introduce new colors, fonts, or design patterns.**

### Theme (`src/styles/theme.ts`)
- **Primary background:** `#0B0B0B` (black)
- **Surface/cards:** `#111111` (ink)
- **Borders:** `#222222` (rule)
- **Accent color:** `#FF5F1F` (orange) — this is the ONLY accent color
- **Text hierarchy:** white `#f5f5f0` → text `#e8e8e8` → body `#b0b0b0` → muted `#888888` → dim `#555555`
- **Status colors:** success `#22C55E`, warning `#F59E0B`, error `#EF4444`, blue `#3B82F6`

### Visual Rules
- Dark theme ONLY — no light mode
- Orange is the singular accent — never introduce purple, teal, or other accents
- All data/numbers use IBM Plex Mono
- All headings use Instrument Sans, weight 700-800, negative letter-spacing
- Labels/metadata: IBM Plex Mono, 10-11px, uppercase, letter-spacing 0.1-0.15em, color `dim`
- Cards: background `ink`, border `1px solid rule`, border-radius 8px
- Status badges: small pill with 9-10px mono text, colored background at 15% opacity
- Animations: subtle — use `cubic-bezier(0.16,1,0.3,1)` for entrances
- Film grain overlay on landing page (canvas-based)
- Circuit-trace SVG background on landing page hero

### Aesthetic Reference
Industrial-technical × editorial. Think Teenage Engineering product pages, Bloomberg Terminal, Braun/Dieter Rams. NOT a generic SaaS template.

## Project Structure

```
unitap/
├── CLAUDE.md                  # This file
├── package.json
├── vite.config.ts             # Proxies /api → localhost:5000
├── tsconfig.json
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Router
│   ├── types/index.ts         # All TypeScript interfaces
│   ├── styles/
│   │   ├── theme.ts           # Design tokens — SINGLE SOURCE OF TRUTH
│   │   └── global.css         # Reset, font imports, keyframe animations
│   ├── lib/
│   │   └── api.ts             # API client (fetch wrapper) + SSE subscription
│   ├── components/            # Shared components (currently empty — build as needed)
│   └── pages/
│       ├── Landing.tsx        # Public landing page (the marketing site)
│       ├── LinkCard.tsx       # NFC card linking via Web NFC API (Android only)
│       └── dashboard/
│           ├── Layout.tsx     # Sidebar nav + <Outlet />
│           ├── Overview.tsx   # Live feed + stat cards
│           ├── Attendance.tsx # Lecture list with status
│           ├── Equipment.tsx  # Equipment cards with queue info
│           └── Societies.tsx  # Society cards + events table
└── backend/                   # Flask backend (to be built)
    ├── app.py                 # Main Flask app
    ├── models/                # MongoDB document schemas
    ├── routes/                # API route blueprints
    └── requirements.txt
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Landing.tsx | Public marketing page |
| `/link-card` | LinkCard.tsx | NFC card pairing (Web NFC API) |
| `/dashboard` | Overview.tsx | Live feed + stats |
| `/dashboard/attendance` | Attendance.tsx | Lecture attendance view |
| `/dashboard/equipment` | Equipment.tsx | Equipment status + queues |
| `/dashboard/societies` | Societies.tsx | Society events + engagement |

## Core Features & User Flows

### 1. Account Creation & Card Linking
- Student creates account with uni email on the web app
- Goes to `/link-card` on Android Chrome
- Taps Mifare Classic student ID card on back of phone
- Web NFC API reads the card's serial number (UID)
- UID is sent to backend and linked to the user's account
- **iPhone users:** An Android friend can use a "Link a friend" feature to scan the card for them (to be built)

### 2. Attendance
- UniTap device is placed at lecture hall door, configured in "attendance" mode
- Device is associated with a specific lecture schedule
- Student taps card → ESP32 sends `POST /api/tap { device_id, card_uid }`
- Backend resolves: who tapped (card_uid → user), which lecture (device_id → device config → lecture)
- Marks attendance, broadcasts via SSE to dashboard
- Prof sees live headcount, late arrivals flagged automatically
- Department can export attendance reports

### 3. Equipment / Inventory Management
- Device mounted on/near lab equipment, configured in "equipment" mode
- Tap to check out → backend creates checkout record
- Tap again to return → backend closes checkout
- If equipment is in use, tap adds student to queue
- Students get notified (via PWA push / dashboard) when it's their turn
- Dashboard shows utilization stats, maintenance scheduling

### 4. Society Events
- Society leads create events on the web dashboard (name, description, date, location, capacity)
- Students browse and register for events on the platform
- On event day, a UniTap device at the venue handles check-in
- Student taps → marked as checked in
- Societies see sign-up vs actual show-up data
- Student Union gets oversight dashboard for funding allocation

## API Specification

### Auth
```
POST /api/auth/register    { email, name, university, password }
POST /api/auth/login       { email, password } → { token, user }
POST /api/auth/link-card   { card_uid } (requires auth token)
GET  /api/auth/me          (requires auth token) → user object
```

### Core Tap Endpoint (ESP32 hits this)
```
POST /api/tap              { device_id, card_uid }
```
Backend logic:
1. Look up user by card_uid
2. Look up device by device_id to get its mode and config
3. Based on mode:
   - `attendance`: mark attendance for the configured lecture
   - `equipment`: check out, return, or join queue
   - `event`: mark event check-in
4. Store tap event
5. Broadcast via SSE

### Attendance
```
GET  /api/attendance/lectures              ?date=YYYY-MM-DD&status=live|ended|upcoming
GET  /api/attendance/lectures/:id          → lecture detail + list of checked-in students
```

### Equipment
```
GET  /api/equipment                        → all equipment with status
GET  /api/equipment/:id                    → detail + queue
POST /api/equipment/:id/queue              { user_id } → join queue
DELETE /api/equipment/:id/queue            { user_id } → leave queue
```

### Societies
```
GET  /api/societies                        → all societies
GET  /api/societies/events                 ?society_id=xxx → events
POST /api/societies/events                 { society_id, name, description, location, date, capacity }
POST /api/societies/events/:id/register    { user_id } → register for event
```

### Devices
```
GET  /api/devices                          → all registered devices
POST /api/devices                          { device_id, name, location, mode }
PATCH /api/devices/:id                     { mode, config }
```

### SSE Stream
```
GET  /api/stream/taps                      → Server-Sent Events stream of tap events
```

## MongoDB Collections

### users
```json
{
  "_id": ObjectId,
  "email": "dheer@kcl.ac.uk",
  "name": "Dheer Maheshwari",
  "password_hash": "...",
  "card_uid": "A1B2C3D4",
  "role": "student",
  "university": "KCL",
  "created_at": ISODate
}
```

### devices
```json
{
  "_id": ObjectId,
  "device_id": "UNITAP-001",
  "name": "Bush House Door",
  "location": "Bush House 1.01",
  "mode": "attendance",
  "config": { "lecture_id": "..." },
  "is_online": true,
  "last_seen": ISODate
}
```

### tap_events
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "device_id": "UNITAP-001",
  "action": "attendance",
  "context": "Database Systems — Bush House 1.01",
  "timestamp": ISODate
}
```

### lectures
```json
{
  "_id": ObjectId,
  "name": "Database Systems",
  "professor": "Dr. Smith",
  "room": "Bush House 1.01",
  "start_time": ISODate,
  "end_time": ISODate,
  "device_id": "UNITAP-001",
  "expected_students": 165,
  "attendees": [ObjectId]
}
```

### equipment
```json
{
  "_id": ObjectId,
  "name": "3D Printer #1",
  "location": "Maker Space",
  "device_id": "UNITAP-003",
  "status": "in-use",
  "current_user_id": ObjectId,
  "queue": [ObjectId],
  "checkout_time": ISODate
}
```

### societies
```json
{
  "_id": ObjectId,
  "name": "KCL Tech",
  "lead_id": ObjectId,
  "members": [ObjectId],
  "description": "..."
}
```

### events
```json
{
  "_id": ObjectId,
  "society_id": ObjectId,
  "name": "Intro to Rust Workshop",
  "description": "...",
  "location": "Bush House LT1",
  "date": ISODate,
  "capacity": 100,
  "registered": [ObjectId],
  "checked_in": [ObjectId],
  "device_id": "UNITAP-005"
}
```

## Coding Conventions

### Frontend
- Use inline styles with theme tokens — import `theme` from `@/styles/theme` or `../../styles/theme`
- `const O = theme.colors` at the top of every component for brevity
- TypeScript strict mode — no `any` unless absolutely necessary
- Prefer named exports for components, default exports for pages
- Keep components in the page file unless they're reused — then extract to `components/`
- Mock data is fine for hackathon — use `// TODO: Replace with API call` comments

### Backend
- Flask blueprints for route organization
- pymongo for MongoDB (not MongoEngine or ODM — keep it simple)
- JWT auth via flask-jwt-extended or manual PyJWT
- SSE via generator functions with `text/event-stream` content type
- CORS enabled for localhost:5173

### General
- This is a hackathon project — ship fast, cut corners on non-demo features
- The demo flow is: Landing page → Dashboard → Live feed updating → Attendance view → Equipment view → Societies → Card linking on phone
- Prioritize the live feed / real-time aspect — that's the wow factor for judges
- If hardware isn't ready, there should be a "simulate tap" button somewhere in the dashboard for demo purposes

## Current State
- Frontend: scaffolded with all pages using mock data, landing page complete, routing works
- Backend: not started yet
- All pages currently render mock/hardcoded data — needs to be wired to real API calls
- The `src/lib/api.ts` client is already written with all endpoint functions and SSE subscription
- Vite proxies `/api` → `localhost:5000`

## What Needs To Be Built Next
1. Flask backend with MongoDB models and all API routes
2. Wire frontend pages to real API calls (replace mock data)
3. SSE stream for live dashboard updates
4. Auth flow (register, login, JWT)
5. "Simulate tap" button for demo mode
6. "Link a friend" feature for iPhone users
