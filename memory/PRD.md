# TheDayLaborers Platform - PRD

## Product Overview
On-demand workforce marketplace connecting Crew Members (workers), Contractors (businesses), and Administrators. Similar to catchoutcrew.com.

## Tech Stack
- **Backend**: Python 3.11 + FastAPI + MongoDB (Motor async)
- **Frontend**: React + TailwindCSS + Lucide Icons
- **Auth**: JWT (Bearer token)
- **Maps**: Leaflet.js + OpenStreetMap
- **Payments**: Stripe (test), PayPal (sandbox), Square/CashApp Pay (production)
- **Real-time**: WebSockets
- **Emails**: Resend API
- **AI**: OpenAI GPT-4o (job matching)
- **Scheduler**: APScheduler (cron jobs)

## User Roles
1. **Crew** - Workers who accept jobs, build profiles, earn ratings
2. **Contractor** - Businesses posting jobs, searching crew, managing workflow
3. **Admin** - Platform management, analytics, settings

---

## ✅ Implemented Features

### Authentication
- JWT-based auth with role-based access
- Registration (crew/contractor) with trade/bio fields saved
- 30-day free trial on signup with welcome points (50)
- Referral code system (100 points per referral)

### Subscription System
- Plans: Daily ($4.99), Weekly ($24.99), Monthly ($79.99), Annual ($699.99)
- Subscription gating: expired users CANNOT post jobs or accept jobs (403 SUBSCRIPTION_EXPIRED)
- Trial + active subscription status tracking
- Subscription expiry auto-detect and status update
- Payment methods: Stripe (card), PayPal, Square/CashApp Pay
- Square/CashApp: production credentials integrated, payment link flow

### Profile System
- Profile completion checklist: Photo, Phone, Address, Skills, Bio (5 checks)
- **Address field** with geocoding (saves lat/lng to location field automatically)
- Profile completion percentage calculated server-side
- Profile completion panel shown in crew dashboard until complete
- Trade saved during registration
- **Social Profile Sharing**: LinkedIn, X/Twitter, Facebook, Native Share/Copy Link
- Admin controls which share platforms are visible (toggle per platform)
- Public profile view at `/profile/:userId` (read-only)

### Location Features
- GPS enable/disable toggle (browser geolocation)
- Location masking (rounded to 2 decimal places for privacy)
- Center map on user location
- Address-based crew search with geocoding

### Map Features
- Live job map (OpenStreetMap + Leaflet)
- Crew marker visibility based on online status
- Radius filter for nearby jobs

### Crew Dashboard
- Online/Offline toggle (visible to contractors)
- GPS location toggle
- Profile completion checklist
- Job filter by trade and radius
- AI smart matching toggle
- Real-time job notifications via WebSocket
- Stats: jobs completed, rating, points, nearby jobs

### Contractor Dashboard
- Crew search by Name, Trade, Location (address geocoded)
- **Crew Profile Popup Modal**: Click "View" on crew card → popup with photo, rating, jobs done, skills, recent reviews, Share + Full Profile buttons
- Crew cards with View Profile (popup), Share Profile, Request Crew buttons
- Job creation with emergency/regular toggle
- Job duplication (1-click repost with "(Copy)" suffix)
- Job status display: Posted/Accepted/In Progress/Completed/Verified
- Real-time notifications for job acceptance

### Job Workflow
- Posted (open) → Accepted (fulfilled) → In Progress (in_progress) → Completed (completed_pending_review) → Verified (completed)
- Status labels displayed correctly in JobCard.jsx
- Contractor: Start Job, Verify Complete
- Crew: Accept Job, Mark Complete

### Emergency Crew Request
- `is_emergency: true` flag on job creation
- Atomic MongoDB findOneAndUpdate race lock (first-to-accept wins)
- 409 returned if slot already claimed
- Red styling + EMERGENCY badge in UI

### App Settings (Crew & Contractor)
- Route: `/settings` — linked from Navbar user dropdown
- **Sound Volume**: 0-100% slider + Test Sound button (Web Audio API beep)
- **Vibration**: toggle (mobile device vibration on alerts)
- **Browser Notifications**: toggle + permission request
- **Push Notifications**: toggle
- **Alert Types**: New Jobs, Job Accepted, Job Declined (individual toggles)
- **Analytics & Usage Data**: opt-in sharing toggle
- All settings persisted to `localStorage` under `thedaylaborers_app_settings`
- Save + Reset to defaults buttons

### Admin Panel
- Analytics: Total users, active jobs, revenue, crew utilization %, online crew, job completion rate
- Jobs by trade bar chart, Top crew leaderboard
- User management: suspend/activate/delete
- **Settings**: Pricing (all 4 plans), trial days, job visibility hours, **Social Sharing toggles** (LinkedIn/X/Facebook/Native Share)
- Payments table with method breakdown

### Cron Job
- APScheduler runs every hour
- Hides completed jobs older than job_visibility_hours (default 12h)

### Payments
- Stripe: create session → status poll
- PayPal: create order → capture
- Square/CashApp: create-link → redirect → status check
- Annual plan support

---

## Architecture

```
/app
├── backend/
│   ├── routes/
│   │   ├── auth_routes.py
│   │   ├── job_routes.py       # CRUD, accept (atomic emergency), start, complete, verify, duplicate
│   │   ├── user_routes.py      # Profile (address+geocoding), crew search, online status, public profile
│   │   ├── admin_routes.py     # Analytics, user mgmt, settings (social links)
│   │   ├── payment_routes.py   # Stripe, PayPal, Square/CashApp
│   │   └── ws_routes.py
│   ├── server.py               # FastAPI app + APScheduler + /api/settings/public
│   └── utils/
└── frontend/
    └── src/
        ├── pages/
        │   ├── CrewDashboard.jsx       # Online toggle, GPS, profile completion
        │   ├── ContractorDashboard.jsx # Crew cards, crew profile popup, emergency, duplication
        │   ├── AdminDashboard.jsx      # Analytics, settings + social links
        │   ├── SubscriptionPage.jsx    # Square/CashApp, annual plan
        │   ├── ProfilePage.jsx         # Address field, social share, public view /profile/:id
        │   └── AppSettingsPage.jsx     # Sound, vibration, notifications, analytics toggle
        └── components/
            ├── JobCard.jsx             # Status labels
            ├── JobMap.jsx
            └── Navbar.jsx              # App Settings in dropdown
```

## Key API Endpoints
- `POST /api/auth/register` - Register with trade/bio
- `POST /api/auth/login` - Get JWT
- `GET /api/users/profile-completion` - Profile % + 5 checks
- `PUT /api/users/online-status` - Set is_online
- `GET /api/users/crew?name=&trade=&address=` - Search crew
- `GET /api/users/public/{user_id}` - Public profile + recent ratings
- `POST /api/jobs/` - Create job (gated)
- `POST /api/jobs/{id}/accept` - Accept (atomic for emergency)
- `POST /api/jobs/{id}/duplicate` - Duplicate
- `GET /api/payments/plans` - daily/weekly/monthly/annual
- `POST /api/payments/square/create-link` - CashApp/Square checkout
- `GET /api/admin/analytics` - Full platform analytics
- `GET /api/settings/public` - Social sharing config (no auth)
- WebSocket: `ws://host/api/ws?token=...`

## Credentials
- Admin: admin@thedaylaborers.com / Admin@123
- Square Location: L6EF13P7EX9GN
- Stripe: test mode | PayPal: sandbox

---

## P1 Backlog (Remaining)
- [ ] Contractor spending dashboard (per-contractor charts)
- [ ] Crew reputation score badge
- [ ] Rate limiting (FastAPI slowapi) to prevent scraping
- [ ] SMS notifications (Twilio — no credentials yet)

## P2 Future
- [ ] React Native mobile app (iOS/Android)
- [ ] Smart AI job matching enhancements
- [ ] Google Auth / social login
- [ ] Crew availability indicator (Green/Yellow/Red)
