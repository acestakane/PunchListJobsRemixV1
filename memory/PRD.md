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
- Completion percentage calculated server-side
- Profile completion panel shown in crew dashboard until complete
- Trade saved during registration

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
- Crew cards with View Profile, Share Profile, Request Crew buttons
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

### Admin Panel
- Analytics: Total users, active jobs, revenue, crew utilization %, online crew, job completion rate
- Jobs by trade bar chart
- Top crew leaderboard
- User management: suspend/activate/delete
- Settings: pricing for all 4 plans, trial days, job visibility hours
- Payments table with method breakdown

### Cron Job
- APScheduler runs every hour
- Hides completed jobs older than job_visibility_hours (default 12 hours)
- is_hidden field filters jobs from listings

### Payments
- Stripe: create session → webhook/status poll
- PayPal: create order → capture
- Square/CashApp: create-link → redirect → status check (order state)
- Annual plan support

---

## Architecture

```
/app
├── backend/
│   ├── routes/
│   │   ├── auth_routes.py      # Register, login
│   │   ├── job_routes.py       # CRUD, accept, start, complete, verify, duplicate, emergency
│   │   ├── user_routes.py      # Profile, crew search, online status, completion
│   │   ├── admin_routes.py     # Analytics, user mgmt, settings
│   │   ├── payment_routes.py   # Stripe, PayPal, Square/CashApp
│   │   └── ws_routes.py        # WebSocket manager
│   ├── models.py               # Pydantic models
│   ├── auth.py                 # JWT utils
│   ├── database.py             # MongoDB connection
│   ├── server.py               # FastAPI app + APScheduler
│   └── utils/
│       ├── geocoding.py        # Address geocoding + haversine
│       ├── email_utils.py      # Resend email
│       └── ai_utils.py         # OpenAI job matching
└── frontend/
    └── src/
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── CrewDashboard.jsx       # Online toggle, GPS, profile completion
        │   ├── ContractorDashboard.jsx # Crew cards, emergency, duplication
        │   ├── AdminDashboard.jsx      # Analytics, settings, users
        │   ├── SubscriptionPage.jsx    # Square/CashApp, annual plan
        │   └── ProfilePage.jsx
        └── components/
            ├── JobCard.jsx             # Status labels, actions
            ├── JobMap.jsx
            └── Navbar.jsx
```

## Key API Endpoints
- `POST /api/auth/register` - Register with trade/bio
- `POST /api/auth/login` - Get JWT
- `GET /api/users/profile-completion` - Profile % + 5 checks
- `PUT /api/users/online-status` - Set is_online
- `GET /api/users/crew?name=&trade=&address=` - Search crew
- `POST /api/jobs/` - Create job (gated)
- `POST /api/jobs/{id}/accept` - Accept (atomic for emergency)
- `POST /api/jobs/{id}/duplicate` - Duplicate
- `POST /api/jobs/{id}/start` - Start (contractor)
- `POST /api/jobs/{id}/verify` - Verify complete (contractor)
- `GET /api/payments/plans` - daily/weekly/monthly/annual
- `POST /api/payments/square/create-link` - CashApp/Square checkout
- `GET /api/payments/square/status/{order_id}` - Check payment
- `GET /api/admin/analytics` - Full platform analytics
- WebSocket: `ws://host/api/ws?token=...`

## DB Schema (key fields)
- **users**: id, email, password_hash, role, name, phone, trade, bio, skills, profile_photo, availability, is_online, location, subscription_status, subscription_plan, subscription_end, trial_end_date, points, referral_code, rating, jobs_completed
- **jobs**: id, contractor_id, title, trade, status, is_emergency, crew_accepted, crew_needed, pay_rate, location, start_time, is_hidden, completed_at
- **payment_transactions**: id, user_id, plan, amount, payment_method, payment_status, session_id/order_id

## Credentials
- Admin: admin@thedaylaborers.com / Admin@123
- Square Location: L6EF13P7EX9GN (Built By Purpose)
- Stripe: test mode (emergent managed key)
- PayPal: sandbox

---

## P0 Backlog (Completed in current session)
- ✅ Subscription gating
- ✅ Profile completion checklist
- ✅ Online/Offline toggle
- ✅ GPS location toggle
- ✅ Crew search fixed (name, trade, address)
- ✅ Job workflow labels (Posted/Accepted/In Progress/Completed/Verified)
- ✅ Emergency job with atomic race lock
- ✅ Job duplication
- ✅ Square/CashApp Pay integration
- ✅ Annual subscription plan
- ✅ Admin analytics enhanced (crew utilization, spending, completion rates)
- ✅ APScheduler cron job (hide completed jobs after 12h)
- ✅ Trade saved during registration

## P1 Backlog (Remaining)
- [ ] Contractor spending dashboard with charts (per contractor)
- [ ] Crew reputation score (visible on cards)
- [ ] SMS notifications via Twilio (no credentials provided)
- [ ] In-app calling with masked numbers (no Twilio)

## P2 Future
- [ ] React Native mobile app (iOS/Android)
- [ ] AI-powered smart job matching enhancements
- [ ] Google Auth / social login
- [ ] Rate limiting middleware (FastAPI slowapi)
- [ ] Crew availability indicator (Green/Yellow/Red)
