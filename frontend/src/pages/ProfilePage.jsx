import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import axios from "axios";
import {
  Camera, Star, Gift, Copy, Check, Edit2, Save, MapPin, Phone, Briefcase,
  User, Plus, X, Linkedin, Twitter, Facebook, Share2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRADES = ["Carpentry", "Electrical", "Plumbing", "Painting", "Landscaping", "Masonry", "HVAC", "Roofing", "Drywall", "General Labor", "Demolition", "Concrete"];
const ALL_SKILLS = ["Framing", "Drywall", "Painting", "Flooring", "Roofing", "Electrical Work", "Plumbing", "Landscaping", "Concrete", "Welding", "HVAC", "Demolition", "Tile Setting", "Cabinetry", "Deck Building"];

function SocialShareButtons({ userId, userName }) {
  const [socialConfig, setSocialConfig] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/settings/public`)
      .then(r => setSocialConfig(r.data))
      .catch(() => setSocialConfig({ social_linkedin_enabled: true, social_twitter_enabled: true, social_facebook_enabled: true, social_native_share_enabled: true }));
  }, []);

  const profileUrl = `${window.location.origin}/profile/${userId}`;
  const shareText = `Check out ${userName}'s profile on TheDayLaborers!`;

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=500");
  };
  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=400");
  };
  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`, "_blank", "width=600,height=400");
  };
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${userName} — TheDayLaborers`, text: shareText, url: profileUrl });
      } catch { }
    } else {
      navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Profile link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!socialConfig) return null;

  return (
    <div className="card p-4">
      <h3 className="font-bold text-[#050A30] dark:text-white text-sm mb-3" style={{ fontFamily: "Manrope, sans-serif" }}>
        Share Your Profile
      </h3>
      <div className="flex flex-wrap gap-2">
        {socialConfig.social_linkedin_enabled && (
          <button onClick={shareLinkedIn}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0077B5] text-white rounded-lg text-xs font-bold hover:bg-[#006097] transition-colors"
            data-testid="share-linkedin-btn">
            <Linkedin className="w-3.5 h-3.5" /> LinkedIn
          </button>
        )}
        {socialConfig.social_twitter_enabled && (
          <button onClick={shareTwitter}
            className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors"
            data-testid="share-twitter-btn">
            <Twitter className="w-3.5 h-3.5" /> X
          </button>
        )}
        {socialConfig.social_facebook_enabled && (
          <button onClick={shareFacebook}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1877F2] text-white rounded-lg text-xs font-bold hover:bg-[#1465d5] transition-colors"
            data-testid="share-facebook-btn">
            <Facebook className="w-3.5 h-3.5" /> Facebook
          </button>
        )}
        {socialConfig.social_native_share_enabled && (
          <button onClick={shareNative}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-600 transition-colors"
            data-testid="share-native-btn">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Share Link"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser, updateUser } = useAuth();
  const { userId } = useParams();  // Viewing another user's profile
  const [viewingUser, setViewingUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [ratings, setRatings] = useState([]);
  const [referralInfo, setReferralInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    // Viewing another user's public profile
    if (userId && userId !== user?.id) {
      axios.get(`${API}/users/public/${userId}`)
        .then(r => setViewingUser(r.data))
        .catch(() => toast.error("Profile not found"));
      return;
    }
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        bio: user.bio || "",
        trade: user.trade || "",
        skills: user.skills || [],
        company_name: user.company_name || "",
        availability: user.availability !== false,
        address: user.address || user.location?.address || "",
      });
      fetchReferralInfo();
      fetchRatings();
    }
  }, [user, userId]);

  const fetchRatings = async () => {
    try {
      const myJobs = await axios.get(`${API}/jobs/my-jobs`);
      const completedJobs = (myJobs.data || []).filter(j => j.status === "completed");
      if (completedJobs.length > 0) {
        const ratingRes = await axios.get(`${API}/jobs/${completedJobs[0].id}/ratings`);
        setRatings(ratingRes.data.filter(r => r.rated_id === user?.id) || []);
      }
    } catch { }
  };

  const fetchReferralInfo = async () => {
    try {
      const res = await axios.get(`${API}/users/referral/info`);
      setReferralInfo(res.data);
    } catch { }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/users/profile`, form);
      updateUser(res.data);
      setEditing(false);
      toast.success("Profile updated!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await axios.post(`${API}/users/upload-photo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      updateUser({ profile_photo: res.data.url, logo: res.data.url });
      toast.success("Photo updated!");
      await refreshUser();
    } catch {
      toast.error("Failed to upload photo");
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(user?.referral_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Referral code copied!");
  };

  const addSkill = (skill) => {
    if (!form.skills.includes(skill)) setForm(f => ({ ...f, skills: [...f.skills, skill] }));
  };
  const removeSkill = (skill) => setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const profilePhoto = user?.profile_photo || user?.logo;
  const profileCompletion = (() => {
    if (!user) return 0;
    const fields = ["name", "phone", "bio", "trade"];
    const filled = fields.filter(f => user[f]).length;
    const hasSkills = user.skills?.length > 0 ? 1 : 0;
    const hasPhoto = profilePhoto ? 1 : 0;
    const hasAddress = (user.address || user.location) ? 1 : 0;
    return Math.round(((filled + hasSkills + hasPhoto + hasAddress) / 7) * 100);
  })();

  const displayAddress = user?.address || user?.location?.address || user?.location?.city || "Not set";

  // Read-only mode when viewing another user's profile
  if (userId && viewingUser) {
    const vu = viewingUser;
    const vuPhoto = vu.profile_photo || vu.logo;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="card p-8 text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-[#050A30] flex items-center justify-center mx-auto border-4 border-[#7EC8E3] mb-4">
              {vuPhoto ? (
                <img src={`${process.env.REACT_APP_BACKEND_URL}${vuPhoto}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-extrabold">{vu.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <h2 className="font-extrabold text-[#050A30] dark:text-white text-2xl mb-1" style={{ fontFamily: "Manrope, sans-serif" }}>{vu.name}</h2>
            <p className="text-slate-500 capitalize">{vu.role}{vu.trade ? ` · ${vu.trade}` : ""}</p>
            <div className="flex items-center justify-center gap-1 mt-2 mb-4">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(vu.rating || 0) ? "text-amber-400 fill-current" : "text-slate-300"}`} />)}
              <span className="text-sm text-slate-500 ml-1">({vu.rating_count || 0} reviews)</span>
            </div>
            {vu.bio && <p className="text-slate-600 dark:text-slate-400 mb-4">{vu.bio}</p>}
            {vu.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                {vu.skills.map(s => <span key={s} className="bg-blue-100 dark:bg-blue-900/50 text-[#0000FF] px-2 py-1 rounded-full text-xs font-semibold">{s}</span>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
                <div className="text-2xl font-extrabold text-[#0000FF]">{vu.jobs_completed || 0}</div>
                <div className="text-xs text-slate-500">Jobs Done</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3">
                <div className="text-2xl font-extrabold text-amber-500">{vu.rating_count > 0 ? vu.rating?.toFixed(1) : "—"}</div>
                <div className="text-xs text-slate-500">Rating</div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <SocialShareButtons userId={vu.id} userName={vu.name} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Profile Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-6 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-[#050A30] flex items-center justify-center mx-auto border-4 border-[#7EC8E3]">
                  {profilePhoto ? (
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${profilePhoto}`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-3xl font-extrabold">{user?.name?.[0]?.toUpperCase()}</span>
                  )}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-[#0000FF] rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
                  data-testid="upload-photo-btn">
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              <h2 className="font-extrabold text-[#050A30] dark:text-white text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>{user?.name}</h2>
              <p className="text-slate-500 text-sm capitalize">{user?.role}{user?.trade ? ` · ${user.trade}` : ""}</p>

              <div className="flex items-center justify-center gap-1 mt-2">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(user?.rating || 0) ? "text-amber-400 fill-current" : "text-slate-300"}`} />
                ))}
                <span className="text-sm text-slate-500 ml-1">({user?.rating_count || 0})</span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Profile Completion</span>
                  <span className="font-semibold text-[#0000FF]">{profileCompletion}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-[#0000FF] h-2 rounded-full transition-all" style={{ width: `${profileCompletion}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
                  <div className="text-xl font-extrabold text-[#0000FF]">{user?.jobs_completed || 0}</div>
                  <div className="text-xs text-slate-500">Jobs Done</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-2">
                  <div className="text-xl font-extrabold text-amber-500">{user?.points || 0}</div>
                  <div className="text-xs text-slate-500">Points</div>
                </div>
              </div>

              {user?.availability !== undefined && (
                <div className="mt-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <span className="text-sm font-semibold text-[#050A30] dark:text-white">Available</span>
                  <div
                    className={`w-12 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${user.availability ? "bg-emerald-500" : "bg-slate-300"}`}
                    onClick={async () => {
                      const newVal = !user.availability;
                      await axios.put(`${API}/users/profile`, { availability: newVal });
                      updateUser({ availability: newVal });
                    }}
                    data-testid="availability-toggle">
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${user.availability ? "translate-x-6" : ""}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Referral Card */}
            {referralInfo && (
              <div className="card p-4 bg-gradient-to-br from-[#050A30] to-[#000C66]">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4 text-[#7EC8E3]" />
                  <h3 className="font-bold text-white text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>Referral Program</h3>
                </div>
                <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center justify-between mb-2">
                  <span className="text-[#7EC8E3] font-mono font-bold">{user?.referral_code}</span>
                  <button onClick={copyReferral} className="text-white p-1" data-testid="copy-referral-btn">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-slate-300 text-xs">{referralInfo.total_referrals} referrals · {referralInfo.points} points</p>
              </div>
            )}

            {/* Social Share */}
            {user && <SocialShareButtons userId={user.id} userName={user.name} />}
          </div>

          {/* Right - Edit Profile */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#050A30] dark:text-white text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>Profile Information</h3>
                {editing ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-500">Cancel</button>
                    <button onClick={saveProfile} disabled={loading}
                      className="px-3 py-1.5 bg-[#0000FF] text-white rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-blue-700 disabled:opacity-60"
                      data-testid="save-profile-btn">
                      <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#0000FF] text-[#0000FF] rounded-lg text-sm font-semibold hover:bg-blue-50"
                    data-testid="edit-profile-btn">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Full Name</label>
                      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                        data-testid="profile-name-input" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Phone</label>
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                        placeholder="+1 (555) 000-0000" data-testid="profile-phone-input" />
                    </div>
                  </div>

                  {/* Address field */}
                  <div>
                    <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">
                      Address <span className="text-slate-400 font-normal">(street, city, state)</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        className="w-full pl-9 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                        placeholder="123 Main St, Atlanta, GA 30301"
                        data-testid="profile-address-input" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Your address will be geocoded automatically for map visibility</p>
                  </div>

                  {user?.role === "crew" && (
                    <div>
                      <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Primary Trade</label>
                      <select value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                        data-testid="profile-trade-select">
                        <option value="">Select trade</option>
                        {TRADES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {user?.role === "contractor" && (
                    <div>
                      <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Company Name</label>
                      <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white" />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1">Bio</label>
                    <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                      placeholder="Tell contractors about your experience..." data-testid="profile-bio-input" />
                  </div>

                  {user?.role === "crew" && (
                    <div>
                      <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-2">Skills</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.skills.map(skill => (
                          <span key={skill} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/50 text-[#0000FF] px-2 py-1 rounded-full text-xs font-semibold">
                            {skill}
                            <button onClick={() => removeSkill(skill)}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ALL_SKILLS.filter(s => !form.skills.includes(s)).map(skill => (
                          <button key={skill} onClick={() => addSkill(skill)}
                            className="text-xs px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 hover:border-[#0000FF] hover:text-[#0000FF]">
                            + {skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { icon: User, label: "Name", value: user?.name },
                    { icon: Phone, label: "Phone", value: user?.phone || "Not set" },
                    { icon: Briefcase, label: user?.role === "contractor" ? "Company" : "Trade", value: (user?.role === "contractor" ? user?.company_name : user?.trade) || "Not set" },
                    { icon: MapPin, label: "Address", value: displayAddress },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <item.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-500 w-20 flex-shrink-0">{item.label}</span>
                      <span className="text-sm font-semibold text-[#050A30] dark:text-white capitalize">{item.value}</span>
                    </div>
                  ))}
                  {user?.bio && (
                    <div className="pt-2">
                      <p className="text-sm text-slate-500 mb-1">Bio</p>
                      <p className="text-sm text-[#050A30] dark:text-slate-300">{user.bio}</p>
                    </div>
                  )}
                  {user?.skills?.length > 0 && (
                    <div className="pt-2">
                      <p className="text-sm text-slate-500 mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {user.skills.map(s => (
                          <span key={s} className="bg-blue-100 dark:bg-blue-900/50 text-[#0000FF] px-2 py-1 rounded-full text-xs font-semibold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Ratings */}
            {ratings.length > 0 && (
              <div className="card p-6">
                <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Recent Reviews</h3>
                <div className="space-y-3">
                  {ratings.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-1">
                        {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.stars ? "text-amber-400 fill-current" : "text-slate-300"}`} />)}
                      </div>
                      {r.review && <p className="text-sm text-slate-600 dark:text-slate-300">{r.review}</p>}
                      <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
