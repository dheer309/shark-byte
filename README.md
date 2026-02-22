# SharkByte

NFC-powered campus engagement platform for KCL — one tap on your student ID card earns XP, builds streaks, and puts you on the leaderboard.

---

## The idea

Students are already carrying an NFC-enabled university ID card. SharkByte turns every tap — attending a lecture, checking into a society event — into a gamified action. Show up consistently, earn badges, climb the leaderboard. Engagement becomes visible and rewarding without any extra apps or hardware for the student.

---

## Gamification

Every tap earns XP and contributes to a streak. The leaderboard is live and updates in real time via SSE.

| Action                     | XP                       |
| -------------------------- | ------------------------ |
| Attend a lecture           | +10                      |
| Be the first to arrive     | +25 (+ Early Bird badge) |
| Check into a society event | +15                      |
| 3-day attendance streak    | +20 bonus                |
| 7-day streak               | +50 bonus                |
| 30-day streak              | +200 bonus               |
| Reach 100 XP               | Century badge            |
| Break into top 10          | Top 10 badge             |
| Attend 5+ events           | Society Star badge       |

Streaks reset if a student misses a day. Best streak is tracked separately so past effort is preserved.

---

## What it does

Students tap their existing Mifare Classic university ID card on any SharkByte device (ESP32 + NFC reader). The system resolves who tapped and what the device is configured for, then performs the appropriate action and pushes a live update to the dashboard.

| Mode           | Action                                               |
| -------------- | ---------------------------------------------------- |
| **Attendance** | Marks the student present, awards XP, updates streak |
| **Event**      | Checks the student into a society event, awards XP   |
| **Equipment**  | Checks out / returns lab equipment                   |

---

## Stack

| Layer     | Tech                         |
| --------- | ---------------------------- |
| Frontend  | React 18 + TypeScript + Vite |
| Backend   | Flask + PyMongo              |
| Database  | MongoDB                      |
| Real-time | Server-Sent Events (SSE)     |
| Auth      | JWT + OTP email (Resend)     |
| Hardware  | ESP32-S3 + PN532 NFC reader  |

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running locally on port 27017

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
MONGO_URI=mongodb://localhost:27017/SharkByte
JWT_SECRET=your-secret-key
RESEND_API_KEY=re_...          # for OTP emails
```

Seed the database:

```bash
python seed.py
```

Run the server:

```bash
python app.py
```

The API runs on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173`. Vite proxies `/api` → `localhost:5000`.

---

## Project structure

```
SharkByte/
├── backend/
│   ├── app.py              # Flask app + SSE
│   ├── seed.py             # Seed MongoDB with demo data
│   ├── requirements.txt
│   └── routes/
│       ├── auth.py         # Register, login, OTP, roles
│       ├── tap.py          # Core tap processing + XP awards
│       ├── gamification.py # Leaderboard, streaks, badges
│       ├── attendance.py   # Lecture endpoints
│       ├── societies.py    # Society + event endpoints
│       ├── equipment.py    # Equipment endpoints
│       ├── devices.py      # Device registry
│       └── stream.py       # SSE stream
└── frontend/
    └── src/
        ├── pages/
        │   ├── Landing.tsx
        │   ├── LinkCard.tsx
        │   └── dashboard/
        │       ├── Layout.tsx
        │       ├── Overview.tsx     # Live feed + personal stats
        │       ├── Leaderboard.tsx  # XP rankings + badges
        │       ├── Societies.tsx    # Events + check-in
        │       ├── Attendance.tsx   # Lecture list (admins)
        │       ├── Equipment.tsx    # Equipment status
        │       └── Profile.tsx      # Account + card linking
        ├── lib/
        │   ├── api.ts
        │   ├── useAuth.ts
        │   └── useWindowSize.ts
        ├── styles/
        │   ├── theme.ts
        │   └── global.css
        └── types/index.ts
```

---

## Roles

| Role            | Permissions                                 |
| --------------- | ------------------------------------------- |
| `student`       | Own tap history, societies, leaderboard     |
| `society_admin` | Create/edit/delete events for their society |
| `class_admin`   | Manage lectures and attendance              |
| `superuser`     | Everything — assign roles, create societies |
