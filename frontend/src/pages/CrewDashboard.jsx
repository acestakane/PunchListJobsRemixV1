import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import Navbar from "../components/Navbar";
import JobMap from "../components/JobMap";
import JobCard from "../components/JobCard";
import { toast } from "sonner";
import axios from "axios";
import {
  MapPin, List, Filter, Zap, Clock, Star, RefreshCw, AlertCircle, X,
  CheckCircle, Camera, Phone, Navigation, Briefcase, FileText, ToggleLeft, ToggleRight, AlertTriangle,
  UserCheck, UserX, MessageCircle
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TRADES = ["All", "Carpentry", "Electrical", "Plumbing", "Painting", "Landscaping", "Masonry", "HVAC", "General Labor"];

export default function CrewDashboard() {
  const { user, refreshUser } = useAuth();
  const { addListener, sendLocation, connected } = useWebSocket();
  const [view, setView] = useState("map");
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(user?.is_online ?? user?.availability ?? false);
  const [loading, setLoading] = useState(true);
  const [tradeFilter, setTradeFilter] = useState("All");
  const [radius, setRadius] = useState(25);
  const [smartMatch, setSmartMatch] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [crewRequests, setCrewRequests] = useState([]);
  const watchIdRef = React.useRef(null);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tradeFilter !== "All") params.append("trade", tradeFilter.toLowerCase());
      if (userLocation && locationEnabled) {
        params.append("lat", userLocation.lat);
        params.append("lng", userLocation.lng);
        params.append("radius", radius);
      }
      if (smartMatch) params.append("smart_match", "true");
      const res = await axios.get(`${API}/jobs/?${params}`);
      setJobs(res.data);
    } catch (e) { console.error("Failed to fetch jobs", e); }
  }, [tradeFilter, userLocation, radius, smartMatch, locationEnabled]);

  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/my-jobs`);
      setMyJobs(res.data);
    } catch { }
  }, []);

  const fetchSubStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/payments/subscription/status`);
      setSubStatus(res.data);
    } catch { }
  }, []);

  const fetchProfileCompletion = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/profile-completion`);
      setProfileCompletion(res.data);
    } catch { }
  }, []);

  const fetchCrewRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/requests`);
      setCrewRequests(res.data);
    } catch { }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchMyJobs(), fetchSubStatus(), fetchProfileCompletion(), fetchCrewRequests()]);
      setLoading(false);
    };
    init();
  }, [fetchJobs, fetchMyJobs, fetchSubStatus, fetchProfileCompletion, fetchCrewRequests]);

  // WebSocket: new job notifications + crew requests
  useEffect(() => {
    const remove = addListener((msg) => {
      if (msg.type === "new_job") {
        setJobs(prev => [msg.job, ...prev.filter(j => j.id !== msg.job.id)]);
        const prefix = msg.job.is_emergency ? "EMERGENCY: " : "New job: ";
        toast.info(`${prefix}${msg.job.title} - $${msg.job.pay_rate}/hr`, {
          action: { label: "View", onClick: () => setSelectedJob(msg.job) }
        });
      }
      if (msg.type === "crew_request") {
        toast.info(`${msg.contractor_name} wants to hire you!`, {
          action: { label: "View", onClick: () => fetchCrewRequests() }
        });
        fetchCrewRequests();
      }
    });
    return remove;
  }, [addListener, fetchCrewRequests]);

  // Location toggle handler with live GPS tracking (watchPosition)
  const toggleLocation = () => {
    if (!locationEnabled) {
      if (navigator.geolocation) {
        // Use watchPosition for live tracking
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            sendLocation(loc.lat, loc.lng);
            axios.post(`${API}/users/location`, { lat: loc.lat, lng: loc.lng }).catch(() => {});
          },
          (err) => {
            if (err.code === 1) toast.error("Location access denied. Please allow in browser settings.");
          },
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
        );
        watchIdRef.current = id;
        setLocationEnabled(true);
        toast.success("Live GPS tracking enabled. Showing nearby jobs.");
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setLocationEnabled(false);
      setUserLocation(null);
      toast.info("Location tracking disabled.");
    }
  };

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Online/Offline toggle
  const toggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    try {
      await axios.put(`${API}/users/online-status`, { is_online: newStatus });
      setIsOnline(newStatus);
      toast.success(newStatus ? "You are now Online — visible to contractors" : "You are now Offline");
    } catch { toast.error("Failed to update status"); }
  };

  const acceptJob = async (jobId) => {
    if (subStatus?.status === "expired") {
      toast.error("Subscription expired. Please renew to accept jobs.");
      return;
    }
    try {
      await axios.post(`${API}/jobs/${jobId}/accept`);
      toast.success("Job accepted!");
      fetchJobs(); fetchMyJobs();
    } catch (e) {
      const detail = e?.response?.data?.detail || "";
      if (detail.includes("SUBSCRIPTION_EXPIRED")) {
        toast.error("Your subscription has expired. Please renew.");
      } else if (detail.includes("already claimed")) {
        toast.warning("Someone else got this emergency job first!");
      } else {
        toast.error(detail || "Failed to accept job");
      }
    }
  };

  const completeJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/complete`);
      toast.success("Job marked as complete. Awaiting contractor verification.");
      fetchMyJobs(); refreshUser();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const acceptCrewRequest = async (requestId) => {
    try {
      await axios.put(`${API}/users/requests/${requestId}/accept`);
      toast.success("Request accepted!");
      fetchCrewRequests();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to accept"); }
  };

  const declineCrewRequest = async (requestId) => {
    try {
      await axios.put(`${API}/users/requests/${requestId}/decline`);
      toast.info("Request declined.");
      fetchCrewRequests();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to decline"); }
  };

  const acceptedIds = myJobs.map(j => j.id);
  const isExpired = subStatus?.status === "expired";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Subscription Expired Banner */}
        {isExpired && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-3 mb-4 flex items-center gap-3" data-testid="subscription-expired-banner">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700 dark:text-red-300">Subscription Expired</p>
              <p className="text-xs text-red-600 dark:text-red-400">Renew to accept jobs and appear on the map</p>
            </div>
            <a href="/subscription"
              className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
              data-testid="renew-subscription-btn">
              Renew Now
            </a>
          </div>
        )}

        {/* Trial Warning */}
        {subStatus?.status === "trial" && subStatus.days_remaining <= 7 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{subStatus.days_remaining} days</strong> left in your free trial.
              <a href="/subscription" className="ml-2 underline font-semibold">Subscribe now</a>
            </p>
          </div>
        )}

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              {user?.name?.split(" ")[0]}'s Dashboard
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
              {connected ? "Live updates active" : "Connecting..."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Online/Offline Toggle */}
            <button onClick={toggleOnlineStatus}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all ${isOnline ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
              data-testid="online-status-toggle">
              {isOnline ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {isOnline ? "Online" : "Offline"}
            </button>

            {/* Location Toggle - Live GPS */}
            <button onClick={toggleLocation}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all ${locationEnabled ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
              data-testid="location-toggle">
              <Navigation className="w-4 h-4" />
              {locationEnabled ? "LIVE ON MAP" : "Enable Location"}
            </button>

            {/* Map/List Toggle */}
            <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              <button onClick={() => setView("map")}
                className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors ${view === "map" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
                data-testid="view-map-btn">
                <MapPin className="w-4 h-4" /> Map
              </button>
              <button onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors ${view === "list" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
                data-testid="view-list-btn">
                <List className="w-4 h-4" /> List
              </button>
            </div>

            <button onClick={() => setSmartMatch(!smartMatch)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${smartMatch ? "bg-[#7EC8E3] text-[#050A30] border-[#7EC8E3]" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}
              data-testid="smart-match-btn">
              <Zap className="w-4 h-4" /> AI
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TRADES.map(t => (
            <button key={t} onClick={() => setTradeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tradeFilter === t ? "bg-[#050A30] text-white border-[#050A30]" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"}`}
              data-testid={`filter-trade-${t.toLowerCase().replace(" ", "-")}`}>
              {t}
            </button>
          ))}
          <select value={radius} onChange={e => setRadius(Number(e.target.value))}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            data-testid="radius-select">
            <option value={10}>10 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
            <option value={100}>100 mi</option>
          </select>
          <button onClick={fetchJobs}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1"
            data-testid="refresh-btn">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map / Job List */}
          <div className="lg:col-span-2">
            {view === "map" ? (
              <JobMap jobs={jobs} userLocation={locationEnabled ? userLocation : null} onJobClick={setSelectedJob} height="500px" />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="card p-4 animate-pulse h-32 bg-slate-200 dark:bg-slate-800" />)
                ) : jobs.length === 0 ? (
                  <div className="card p-10 text-center">
                    <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-semibold">No jobs found</p>
                    <p className="text-slate-400 text-sm mt-1">Try enabling GPS or expanding radius</p>
                  </div>
                ) : jobs.map(job => (
                  <JobCard key={job.id} job={job} onAccept={acceptJob} onComplete={completeJob}
                    currentUser={user} isAccepted={acceptedIds.includes(job.id)} isExpired={isExpired} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Profile Completion */}
            {profileCompletion && !profileCompletion.is_complete && (
              <div className="card p-4" data-testid="profile-completion-panel">
                <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Profile Completion ({profileCompletion.percentage}%)
                </h3>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3">
                  <div className="bg-[#0000FF] h-2 rounded-full transition-all" style={{ width: `${profileCompletion.percentage}%` }} />
                </div>
                <div className="space-y-2">
                  {[
                    { key: "photo", icon: Camera, label: "Profile Photo" },
                    { key: "phone", icon: Phone, label: "Phone Number" },
                    { key: "address", icon: MapPin, label: "Location/Address" },
                    { key: "skills", icon: Briefcase, label: "Trade/Skills" },
                    { key: "bio", icon: FileText, label: "Bio" },
                  ].map(({ key, icon: Icon, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      {profileCompletion.checks[key] ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                      )}
                      <span className={`text-xs ${profileCompletion.checks[key] ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-300"}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <a href="/profile"
                  className="mt-3 block text-center text-xs font-bold text-[#0000FF] hover:underline"
                  data-testid="complete-profile-link">
                  Complete Profile →
                </a>
              </div>
            )}

            {/* Quick Stats */}
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>Your Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-[#0000FF]">{user?.jobs_completed || 0}</div>
                  <div className="text-xs text-slate-500">Jobs Done</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-amber-500">{user?.rating_count > 0 ? user.rating.toFixed(1) : "—"}</div>
                  <div className="text-xs text-slate-500">Rating</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-emerald-500">{user?.points || 0}</div>
                  <div className="text-xs text-slate-500">Points</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-purple-500">{jobs.length}</div>
                  <div className="text-xs text-slate-500">Nearby</div>
                </div>
              </div>
            </div>

            {/* My Active Jobs */}
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>My Active Jobs</h3>
              {myJobs.filter(j => ["in_progress", "fulfilled", "open"].includes(j.status)).length === 0 ? (
                <p className="text-slate-400 text-sm">No active jobs. Accept a job to get started!</p>
              ) : (
                <div className="space-y-2">
                  {myJobs.filter(j => ["in_progress", "fulfilled", "open"].includes(j.status)).map(job => (
                    <JobCard key={job.id} job={job} onComplete={completeJob} currentUser={user} isAccepted={true} />
                  ))}
                </div>
              )}
            </div>

            {/* Crew Requests */}
            {crewRequests.filter(r => r.status === "pending").length > 0 && (
              <div className="card p-4" data-testid="crew-requests-panel">
                <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                  <MessageCircle className="w-4 h-4 text-[#0000FF]" />
                  Crew Requests ({crewRequests.filter(r => r.status === "pending").length})
                </h3>
                <div className="space-y-2">
                  {crewRequests.filter(r => r.status === "pending").slice(0, 5).map(req => (
                    <div key={req.id} className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3" data-testid={`crew-request-${req.id}`}>
                      <p className="text-sm font-bold text-[#050A30] dark:text-white">{req.contractor_name}</p>
                      {req.contractor_company && <p className="text-xs text-slate-500">{req.contractor_company}</p>}
                      {req.message && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{req.message}</p>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => acceptCrewRequest(req.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          data-testid={`accept-request-${req.id}`}>
                          <UserCheck className="w-3 h-3" /> Accept
                        </button>
                        <button onClick={() => declineCrewRequest(req.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                          data-testid={`decline-request-${req.id}`}>
                          <UserX className="w-3 h-3" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral Code */}
            <div className="card p-4 bg-gradient-to-br from-[#050A30] to-[#000C66]">
              <h3 className="font-bold text-white text-sm mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>Your Referral Code</h3>
              <div className="bg-white/10 rounded-lg px-4 py-2 text-[#7EC8E3] font-mono font-bold text-lg text-center mb-2">
                {user?.referral_code}
              </div>
              <p className="text-slate-300 text-xs text-center">Share & earn 100 points per referral</p>
            </div>
          </div>
        </div>

        {/* Job Detail Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
            <div className="card max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedJob(null)} className="absolute top-4 right-4 text-slate-400"><X className="w-5 h-5" /></button>
              {selectedJob.is_emergency && (
                <div className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 mb-3">
                  <AlertTriangle className="w-3 h-3" /> EMERGENCY JOB
                </div>
              )}
              <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>{selectedJob.title}</h2>
              <p className="text-slate-500 text-sm mb-4">{selectedJob.contractor_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{selectedJob.description}</p>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span className="text-slate-500">Pay Rate:</span><span className="font-bold text-[#0000FF]">${selectedJob.pay_rate}/hr</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Trade:</span><span className="font-semibold capitalize">{selectedJob.trade}</span></div>
              </div>
              {selectedJob.status === "open" && !acceptedIds.includes(selectedJob.id) && (
                <button onClick={() => { acceptJob(selectedJob.id); setSelectedJob(null); }}
                  disabled={isExpired}
                  className={`w-full py-3 rounded-xl font-bold transition-colors ${isExpired ? "bg-slate-300 text-slate-500 cursor-not-allowed" : selectedJob.is_emergency ? "bg-red-600 text-white hover:bg-red-700" : "bg-[#0000FF] text-white hover:bg-blue-700"}`}
                  data-testid="modal-accept-job">
                  {isExpired ? "Subscription Expired" : selectedJob.is_emergency ? "Accept Emergency Job" : "Accept This Job"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
