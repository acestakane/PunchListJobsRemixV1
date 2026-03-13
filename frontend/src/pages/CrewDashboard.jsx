import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import Navbar from "../components/Navbar";
import JobMap from "../components/JobMap";
import JobCard from "../components/JobCard";
import { toast } from "sonner";
import axios from "axios";
import { MapPin, List, Filter, Search, Zap, Clock, Star, RefreshCw, AlertCircle, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRADES = ["All", "Carpentry", "Electrical", "Plumbing", "Painting", "Landscaping", "Masonry", "HVAC", "General Labor"];

export default function CrewDashboard() {
  const { user, refreshUser } = useAuth();
  const { addListener, sendLocation, connected } = useWebSocket();
  const [view, setView] = useState("map");
  const [jobs, setJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeFilter, setTradeFilter] = useState("All");
  const [radius, setRadius] = useState(25);
  const [smartMatch, setSmartMatch] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null);

  // Check profile completeness
  const profileComplete = user?.name && user?.trade && user?.phone && (user?.skills?.length > 0);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tradeFilter !== "All") params.append("trade", tradeFilter.toLowerCase());
      if (userLocation) {
        params.append("lat", userLocation.lat);
        params.append("lng", userLocation.lng);
        params.append("radius", radius);
      }
      if (smartMatch) params.append("smart_match", "true");

      const res = await axios.get(`${API}/jobs/?${params}`);
      setJobs(res.data);
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    }
  }, [tradeFilter, userLocation, radius, smartMatch]);

  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/my-jobs`);
      setMyJobs(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchTrialInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/users/trial-status`);
      setTrialInfo(res.data);
    } catch (e) { }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchMyJobs(), fetchTrialInfo()]);
      setLoading(false);
    };
    init();
  }, [fetchJobs, fetchMyJobs, fetchTrialInfo]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          sendLocation(loc.lat, loc.lng);
        },
        () => { /* Location denied */ }
      );
    }
  }, [sendLocation]);

  // WebSocket listener for new jobs
  useEffect(() => {
    const remove = addListener((msg) => {
      if (msg.type === "new_job") {
        setJobs(prev => [msg.job, ...prev.filter(j => j.id !== msg.job.id)]);
        toast.info(`New job: ${msg.job.title} - $${msg.job.pay_rate}/hr`, {
          action: { label: "View", onClick: () => setSelectedJob(msg.job) }
        });
      }
    });
    return remove;
  }, [addListener]);

  const acceptJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/accept`);
      toast.success("Job accepted!");
      fetchJobs();
      fetchMyJobs();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to accept job");
    }
  };

  const completeJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/complete`);
      toast.success("Job marked as complete. Awaiting contractor verification.");
      fetchMyJobs();
      refreshUser();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const acceptedIds = myJobs.map(j => j.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Trial Banner */}
        {trialInfo?.is_trial && trialInfo.days_remaining <= 7 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{trialInfo.days_remaining} days</strong> left in your free trial.
              <a href="/subscription" className="ml-2 underline font-semibold">Subscribe now</a>
            </p>
          </div>
        )}

        {/* Profile Incomplete Warning */}
        {!profileComplete && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3 mb-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#0000FF] flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Complete your profile to get better job matches.
              <a href="/profile" className="ml-2 underline font-semibold">Complete profile</a>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
              {connected ? "Live updates active" : "Connecting..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setView("map")}
                className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors ${view === "map" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
                data-testid="view-map-btn"
              >
                <MapPin className="w-4 h-4" /> Map
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-colors ${view === "list" ? "bg-[#0000FF] text-white" : "text-slate-500"}`}
                data-testid="view-list-btn"
              >
                <List className="w-4 h-4" /> List
              </button>
            </div>
            <button
              onClick={() => setSmartMatch(!smartMatch)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${smartMatch ? "bg-[#7EC8E3] text-[#050A30] border-[#7EC8E3]" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}
              data-testid="smart-match-btn"
              title="AI Smart Matching"
            >
              <Zap className="w-4 h-4" /> AI Match
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TRADES.map(t => (
            <button
              key={t}
              onClick={() => { setTradeFilter(t); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tradeFilter === t ? "bg-[#050A30] text-white border-[#050A30]" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"}`}
              data-testid={`filter-trade-${t.toLowerCase()}`}
            >
              {t}
            </button>
          ))}
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            data-testid="radius-select"
          >
            <option value={10}>10 mi</option>
            <option value={25}>25 mi</option>
            <option value={50}>50 mi</option>
            <option value={100}>100 mi</option>
          </select>
          <button onClick={fetchJobs} className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 flex items-center gap-1" data-testid="refresh-btn">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Job List / Map */}
          <div className="lg:col-span-2">
            {view === "map" ? (
              <JobMap
                jobs={jobs}
                userLocation={userLocation}
                onJobClick={setSelectedJob}
                height="500px"
              />
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="card p-4 animate-pulse h-32 bg-slate-200 dark:bg-slate-800" />
                  ))
                ) : jobs.length === 0 ? (
                  <div className="card p-10 text-center">
                    <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-semibold">No jobs found nearby</p>
                    <p className="text-slate-400 text-sm mt-1">Try expanding your search radius</p>
                  </div>
                ) : jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onAccept={acceptJob}
                    onComplete={completeJob}
                    currentUser={user}
                    isAccepted={acceptedIds.includes(job.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>Your Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-[#0000FF]">{user?.jobs_completed || 0}</div>
                  <div className="text-xs text-slate-500">Jobs Done</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold text-amber-500">{user?.rating?.toFixed(1) || "—"}</div>
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
                    <JobCard
                      key={job.id}
                      job={job}
                      onComplete={completeJob}
                      currentUser={user}
                      isAccepted={true}
                    />
                  ))}
                </div>
              )}
            </div>

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
              <button onClick={() => setSelectedJob(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>{selectedJob.title}</h2>
              <p className="text-slate-500 text-sm mb-4">{selectedJob.contractor_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{selectedJob.description}</p>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span className="text-slate-500">Pay Rate:</span><span className="font-bold text-[#0000FF]">${selectedJob.pay_rate}/hr</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Trade:</span><span className="font-semibold capitalize">{selectedJob.trade}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Location:</span><span>{selectedJob.location?.address}</span></div>
              </div>
              {selectedJob.status === "open" && !acceptedIds.includes(selectedJob.id) && (
                <button
                  onClick={() => { acceptJob(selectedJob.id); setSelectedJob(null); }}
                  className="w-full bg-[#0000FF] text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  data-testid="modal-accept-job"
                >
                  Accept This Job
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
