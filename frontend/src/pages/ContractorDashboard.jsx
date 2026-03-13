import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import Navbar from "../components/Navbar";
import JobMap from "../components/JobMap";
import JobCard from "../components/JobCard";
import { toast } from "sonner";
import axios from "axios";
import { Search, Plus, Zap, Users, Briefcase, Star, MapPin, ChevronRight, X, AlertTriangle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRADES = ["Carpentry", "Electrical", "Plumbing", "Painting", "Landscaping", "Masonry", "HVAC", "Roofing", "Drywall", "General Labor", "Demolition", "Concrete"];

function RatingModal({ job, onClose, onSubmit }) {
  const [ratings, setRatings] = useState({});
  const [reviews, setReviews] = useState({});

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><X className="w-5 h-5" /></button>
        <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Rate Workers</h2>
        {job.crew_accepted?.map(crewId => (
          <div key={crewId} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm font-semibold mb-2">Worker ID: {crewId.slice(0, 8)}...</p>
            <div className="flex gap-1 mb-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRatings(r => ({ ...r, [crewId]: s }))}
                  className={`text-2xl transition-colors ${(ratings[crewId] || 0) >= s ? "text-amber-400" : "text-slate-300"}`}>★</button>
              ))}
            </div>
            <textarea
              placeholder="Write a review..."
              value={reviews[crewId] || ""}
              onChange={e => setReviews(r => ({ ...r, [crewId]: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-sm dark:bg-slate-700 dark:text-white"
              rows={2}
            />
          </div>
        ))}
        <button
          onClick={() => onSubmit(job, ratings, reviews)}
          className="w-full bg-[#0000FF] text-white py-3 rounded-xl font-bold hover:bg-blue-700"
          data-testid="submit-ratings-btn"
        >
          Submit Ratings
        </button>
      </div>
    </div>
  );
}

export default function ContractorDashboard() {
  const { user } = useAuth();
  const { addListener, connected } = useWebSocket();
  const [jobs, setJobs] = useState([]);
  const [crew, setCrew] = useState([]);
  const [crewSearch, setCrewSearch] = useState({ name: "", trade: "" });
  const [showJobForm, setShowJobForm] = useState(false);
  const [ratingJob, setRatingJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobForm, setJobForm] = useState({
    title: "", description: "", trade: "", crew_needed: 1,
    start_time: "", pay_rate: "", address: "", is_emergency: false
  });

  const fetchJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/jobs/`);
      setJobs(res.data);
    } catch (e) { console.error(e); }
  }, []);

  const fetchCrew = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (crewSearch.name) params.append("name", crewSearch.name);
      if (crewSearch.trade) params.append("trade", crewSearch.trade);
      const res = await axios.get(`${API}/users/crew?${params}`);
      setCrew(res.data);
    } catch (e) { console.error(e); }
  }, [crewSearch]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchCrew()]);
      setLoading(false);
    };
    init();
  }, [fetchJobs, fetchCrew]);

  useEffect(() => {
    const remove = addListener(msg => {
      if (msg.type === "job_accepted") {
        toast.success(`Worker accepted your job! (${msg.crew_count}/${msg.crew_needed} filled)`);
        fetchJobs();
      }
      if (msg.type === "job_completed") {
        toast.info(`Job "${msg.job_title}" has been marked complete by crew. Please verify.`);
        fetchJobs();
      }
    });
    return remove;
  }, [addListener, fetchJobs]);

  const createJob = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/jobs/`, { ...jobForm, crew_needed: Number(jobForm.crew_needed), pay_rate: Number(jobForm.pay_rate) });
      toast.success("Job posted! Workers will be notified instantly.");
      setShowJobForm(false);
      setJobForm({ title: "", description: "", trade: "", crew_needed: 1, start_time: "", pay_rate: "", address: "", is_emergency: false });
      fetchJobs();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to post job");
    }
  };

  const startJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/start`);
      toast.success("Job started!");
      fetchJobs();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const verifyJob = async (jobId) => {
    try {
      await axios.post(`${API}/jobs/${jobId}/verify`);
      toast.success("Job verified and completed!");
      fetchJobs();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const submitRatings = async (job, ratings, reviews) => {
    try {
      for (const [crewId, stars] of Object.entries(ratings)) {
        if (stars > 0) {
          await axios.post(`${API}/jobs/${job.id}/rate`, {
            rated_id: crewId, job_id: job.id, stars, review: reviews[crewId] || ""
          });
        }
      }
      toast.success("Ratings submitted!");
      setRatingJob(null);
    } catch (e) { toast.error("Failed to submit ratings"); }
  };

  const saveFavorite = async (crewId) => {
    try {
      await axios.post(`${API}/users/favorites/${crewId}`);
      toast.success("Added to favorites");
    } catch (e) { toast.error("Failed"); }
  };

  const updateForm = (k, v) => setJobForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
              {user?.company_name || user?.name}
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
              {connected ? "Live updates active" : "Connecting..."}
            </p>
          </div>
          <button
            onClick={() => setShowJobForm(true)}
            className="flex items-center gap-2 bg-[#0000FF] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            data-testid="post-job-btn"
          >
            <Plus className="w-4 h-4" /> Post Job
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT SIDEBAR - Crew Search */}
          <div className="lg:col-span-3 space-y-3">
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>Search Crew</h3>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Name..."
                    value={crewSearch.name}
                    onChange={e => setCrewSearch(s => ({ ...s, name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="crew-search-name"
                  />
                </div>
                <select
                  value={crewSearch.trade}
                  onChange={e => setCrewSearch(s => ({ ...s, trade: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="crew-search-trade"
                >
                  <option value="">All Trades</option>
                  {TRADES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Crew List */}
            <div className="card overflow-hidden">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-[#050A30] dark:text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Available Crew ({crew.length})</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {crew.length === 0 ? (
                  <div className="p-6 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">No crew found</p>
                  </div>
                ) : crew.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" data-testid={`crew-member-${member.id}`}>
                    <div className="w-9 h-9 bg-[#050A30] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {member.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#050A30] dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{member.trade || "General"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{member.rating?.toFixed(1) || "New"}</span>
                      </div>
                      <button onClick={() => saveFavorite(member.id)} className="text-[#0000FF] hover:text-blue-800" title="Save favorite">
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER - Map */}
          <div className="lg:col-span-6">
            <JobMap
              jobs={jobs.filter(j => ["open", "fulfilled", "in_progress"].includes(j.status))}
              crew={crew}
              height="580px"
            />
          </div>

          {/* RIGHT SIDEBAR - Jobs */}
          <div className="lg:col-span-3 space-y-3">
            <div className="card p-4">
              <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>My Jobs ({jobs.length})</h3>
              <div className="flex gap-2 mb-3">
                <div className="text-center flex-1 bg-emerald-50 dark:bg-emerald-950 rounded-lg p-2">
                  <div className="font-extrabold text-emerald-600">{jobs.filter(j => j.status === "open").length}</div>
                  <div className="text-xs text-slate-500">Open</div>
                </div>
                <div className="text-center flex-1 bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
                  <div className="font-extrabold text-blue-600">{jobs.filter(j => j.status === "in_progress").length}</div>
                  <div className="text-xs text-slate-500">Active</div>
                </div>
                <div className="text-center flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                  <div className="font-extrabold text-gray-600">{jobs.filter(j => j.status === "completed").length}</div>
                  <div className="text-xs text-slate-500">Done</div>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {jobs.length === 0 ? (
                <div className="card p-6 text-center">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold text-sm">No jobs yet</p>
                  <button onClick={() => setShowJobForm(true)} className="mt-3 text-[#0000FF] text-sm font-semibold">Post your first job</button>
                </div>
              ) : jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onStart={startJob}
                  onVerify={verifyJob}
                  onRate={setRatingJob}
                  currentUser={user}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Job Modal */}
      {showJobForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-lg w-full p-6 relative my-4">
            <button onClick={() => setShowJobForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>Post a Job</h2>
            <p className="text-slate-500 text-sm mb-5">Workers will be notified in real-time</p>

            <form onSubmit={createJob} className="space-y-4">
              <div className="flex gap-2 mb-2">
                <button type="button"
                  onClick={() => updateForm("is_emergency", false)}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 transition-colors ${!jobForm.is_emergency ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200"}`}
                  data-testid="regular-job-btn">
                  Regular Job
                </button>
                <button type="button"
                  onClick={() => updateForm("is_emergency", true)}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 flex items-center justify-center gap-1 transition-colors ${jobForm.is_emergency ? "bg-yellow-400 text-[#050A30] border-yellow-400" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200"}`}
                  data-testid="emergency-job-btn">
                  <AlertTriangle className="w-4 h-4" /> Emergency
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Job Title *</label>
                <input type="text" required value={jobForm.title} onChange={e => updateForm("title", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="e.g. Framing Crew Needed" data-testid="job-title-input" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Description</label>
                <textarea value={jobForm.description} onChange={e => updateForm("description", e.target.value)} rows={3}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="Describe the work..." data-testid="job-desc-input" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Trade *</label>
                  <select required value={jobForm.trade} onChange={e => updateForm("trade", e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="job-trade-select">
                    <option value="">Select trade</option>
                    {TRADES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Crew Needed *</label>
                  <input type="number" min="1" max="50" required value={jobForm.crew_needed} onChange={e => updateForm("crew_needed", e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="job-crew-needed-input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Start Time *</label>
                  <input type="datetime-local" required value={jobForm.start_time} onChange={e => updateForm("start_time", e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid="job-start-time-input" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Pay Rate ($/hr) *</label>
                  <input type="number" min="1" step="0.50" required value={jobForm.pay_rate} onChange={e => updateForm("pay_rate", e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    placeholder="25.00" data-testid="job-pay-rate-input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Job Location (Address) *</label>
                <input type="text" required value={jobForm.address} onChange={e => updateForm("address", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="123 Main St, Miami, FL" data-testid="job-address-input" />
              </div>

              <button type="submit"
                className="w-full bg-[#0000FF] text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                data-testid="submit-job-btn">
                Post Job Now
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingJob && (
        <RatingModal job={ratingJob} onClose={() => setRatingJob(null)} onSubmit={submitRatings} />
      )}
    </div>
  );
}
