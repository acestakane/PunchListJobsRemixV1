# TheDayLaborers - A Blue Collar ME Company
## Product Requirements Document

**Last Updated:** March 2025
**Status:** MVP Complete

---

## Problem Statement
Build a scalable on-demand workforce marketplace connecting Crew Members (workers), Contractors (businesses), and Administrators. The platform supports real-time job dispatch, live maps, and instant job acceptance similar to CatchOutCrew.com and PeopleReady.com.

---

## Architecture

### Tech Stack
- **Frontend:** React 19, TailwindCSS, React-Leaflet (OpenStreetMap), Recharts, Sonner
- **Backend:** FastAPI (Python), Motor (async MongoDB driver)
- **Database:** MongoDB
- **Real-time:** FastAPI WebSockets
- **Payments:** Stripe (emergentintegrations), PayPal REST API (sandbox)
- **Email:** Resend API
- **AI:** OpenAI GPT-4o via emergentintegrations (Emergent LLM Key)
- **Maps:** OpenStreetMap via React-Leaflet + Leaflet.js
- **Auth:** JWT (python-jose + bcrypt)

### URL Structure
- Frontend: https://job-marketplace-61.preview.emergentagent.com
- Backend API: https://job-marketplace-61.preview.emergentagent.com/api
- WebSocket: wss://job-match-now.preview.emergentagent.com/api/ws/{token}

---

## User Personas

### 1. Crew Member (Worker)
- Blue collar professional seeking day work
- Needs: See nearby jobs on map, accept quickly, track earnings/ratings
- Mobile-first user

### 2. Contractor (Business)
- Construction company or business needing immediate labor
- Needs: Post jobs fast, find qualified nearby workers, track job status
- Mostly desktop, some mobile

### 3. Administrator
- Platform manager
- Needs: Full platform control, analytics, user management, pricing config

---

## Core Requirements (Static)

1. ✅ JWT Authentication (Register/Login for crew/contractor/admin)
2. ✅ Three-role system (crew, contractor, admin)
3. ✅ Live job map (OpenStreetMap/Leaflet)
4. ✅ Real-time WebSocket job updates
5. ✅ Job workflow (open → fulfilled → in_progress → completed_pending_review → completed)
6. ✅ Ratings system (mutual ratings after job completion)
7. ✅ Subscription system (30-day trial + daily/weekly/monthly plans)
8. ✅ PayPal sandbox payments
9. ✅ Stripe payments (test mode via emergentintegrations)
10. ✅ Admin dashboard with analytics
11. ✅ Referral system with points economy
12. ✅ AI-powered job matching (OpenAI GPT-4o)
13. ✅ Email notifications (Resend API)
14. ✅ Profile management with photo upload
15. ✅ Geocoding via Nominatim (OpenStreetMap)
16. ✅ Dark/light mode toggle
17. ✅ Mobile-first responsive design
18. ✅ PWA manifest

---

## What's Been Implemented

### Backend (FastAPI)
- `server.py` - Main app, startup init (admin creation, indexes, settings)
- `database.py` - MongoDB connection
- `auth.py` - JWT helpers, password hashing, current_user dependency
- `models.py` - Pydantic models for all requests
- `routes/auth_routes.py` - Register, Login with referral code support
- `routes/job_routes.py` - Full job CRUD + accept/start/complete/verify/rate
- `routes/user_routes.py` - Profile management, crew search, favorites, location, referrals
- `routes/admin_routes.py` - Analytics, user management, settings, terms, map data
- `routes/payment_routes.py` - Stripe + PayPal create/capture/status + subscription management
- `routes/ws_routes.py` - WebSocket connection manager with location tracking
- `utils/email_utils.py` - Resend email notifications (welcome, job, subscription)
- `utils/ai_utils.py` - OpenAI job matching and fraud detection
- `utils/geocoding.py` - Nominatim geocoding + haversine distance

### Frontend (React)
- `App.js` - Router with protected routes, role-based redirects
- `App.css` - Global styles with Manrope/Inter fonts
- `contexts/AuthContext.jsx` - JWT auth state management
- `contexts/ThemeContext.jsx` - Dark/light mode toggle
- `contexts/WebSocketContext.jsx` - WebSocket connection with auto-reconnect
- `components/Navbar.jsx` - Responsive nav with dropdown
- `components/JobMap.jsx` - Leaflet map with custom pins for jobs/crew/user
- `components/JobCard.jsx` - Job card with status-aware action buttons
- `pages/LandingPage.jsx` - Hero + features + how-it-works + stats + footer
- `pages/AuthPage.jsx` - Login/register with role selection (crew/contractor)
- `pages/CrewDashboard.jsx` - Map + job list + filters + AI match + active jobs
- `pages/ContractorDashboard.jsx` - 3-panel: crew search + map + job list + create modal
- `pages/AdminDashboard.jsx` - Analytics + user table + settings + terms + payments
- `pages/ProfilePage.jsx` - Profile edit + photo upload + skills + ratings + referral
- `pages/SubscriptionPage.jsx` - Plan selection + PayPal + Stripe payment

---

## Default Credentials
- **Admin:** admin@thedaylaborers.com / Admin@123
- **Subscription Plans:** Daily $4.99, Weekly $24.99, Monthly $79.99 (configurable)
- **Trial Duration:** 30 days

---

## Prioritized Backlog

### P0 (Critical - Launch Blockers)
- [ ] Square payments integration (placeholder only, needs credentials)
- [ ] Email verification flow (send code, verify endpoint)
- [ ] Push notifications (PWA service worker)

### P1 (Important - Post-Launch)
- [ ] Advanced fraud detection with AI rules engine
- [ ] Job history analytics for contractors (spending charts)
- [ ] SMS notifications (Twilio integration)
- [ ] Worker ID verification flow
- [ ] Multi-image support for job posts

### P2 (Nice to Have)
- [ ] Native iOS/Android PWA full offline support
- [ ] Advanced search with radius on maps
- [ ] Chat between contractor and crew member
- [ ] Shift scheduling / recurring jobs
- [ ] Payroll integration (direct deposit to workers)

---

## Next Tasks List
1. Set up Square payment credentials and implement
2. Add SMS notification via Twilio
3. Set up email domain verification for Resend (currently using onboarding@resend.dev)
4. Add job expiration cron (12-hour visibility after completion)
5. Implement push notifications via service worker
6. Add contractor analytics page (spending history, worker performance)
7. Set up production MongoDB with proper authentication
