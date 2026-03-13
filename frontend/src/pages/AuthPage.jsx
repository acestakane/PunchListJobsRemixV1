import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Briefcase, Users, ArrowLeft, CheckCircle } from "lucide-react";

const HERO_BG = "https://images.unsplash.com/photo-1693478501743-799eefbc0ecd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlJTIwdGVhbSUyMHdvcmtpbmd8ZW58MHx8fHwxNzczMzk4OTM5fDA&ixlib=rb-4.1.0&q=85";

const TRADES = ["Carpentry", "Electrical", "Plumbing", "Painting", "Landscaping", "Masonry", "HVAC", "Roofing", "Drywall", "General Labor", "Demolition", "Concrete"];

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState(params.get("mode") || "login");
  const [role, setRole] = useState(params.get("role") || "crew");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "", password: "", name: "", phone: "",
    company_name: "", referral_code_used: "", trade: ""
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        toast.success(`Welcome back, ${user.name}!`);
        if (user.role === "crew") navigate("/crew/dashboard");
        else if (user.role === "contractor") navigate("/contractor/dashboard");
        else navigate("/admin/dashboard");
      } else {
        if (!form.name.trim()) { toast.error("Name is required"); return; }
        if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        const payload = { ...form, role };
        if (role !== "contractor") delete payload.company_name;
        if (role !== "crew") delete payload.trade;
        const user = await register(payload);
        toast.success(`Welcome to TheDayLaborers, ${user.name}! Your 30-day trial has started.`);
        if (user.role === "crew") navigate("/crew/dashboard");
        else navigate("/contractor/dashboard");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(5,10,48,0.95) 0%, rgba(0,0,255,0.3) 100%), url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#0000FF] rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-white font-extrabold text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>TheDayLaborers</div>
              <div className="text-[#7EC8E3] text-xs">A Blue Collar ME Company</div>
            </div>
          </Link>

          <div>
            <h2 className="text-4xl font-extrabold text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
              Your work.<br />Your terms.
            </h2>
            <p className="text-slate-300 text-lg mb-8">Real-time workforce marketplace for blue collar professionals.</p>
            <div className="space-y-3">
              {["30-day free trial", "Live job map", "Instant payouts", "AI job matching"].map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#7EC8E3]" />
                  <span className="text-slate-200">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 lg:w-1/2 bg-white dark:bg-[#020617] flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>

          {/* Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-8">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === "login" ? "bg-[#0000FF] text-white shadow-md" : "text-slate-500 dark:text-slate-400"}`}
              data-testid="auth-login-tab"
            >
              Log In
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === "register" ? "bg-[#0000FF] text-white shadow-md" : "text-slate-500 dark:text-slate-400"}`}
              data-testid="auth-register-tab"
            >
              Sign Up
            </button>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#050A30] dark:text-white mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
            {mode === "login" ? "Sign in to your TheDayLaborers account" : "Join thousands of workers and contractors"}
          </p>

          {/* Role Selector (Register only) */}
          {mode === "register" && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setRole("crew")}
                className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-sm transition-all ${role === "crew" ? "border-[#0000FF] bg-blue-50 dark:bg-blue-950 text-[#0000FF]" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"}`}
                data-testid="role-crew-btn"
              >
                <Users className="w-5 h-5" />
                Crew Member
              </button>
              <button
                onClick={() => setRole("contractor")}
                className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-sm transition-all ${role === "contractor" ? "border-[#0000FF] bg-blue-50 dark:bg-blue-950 text-[#0000FF]" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"}`}
                data-testid="role-contractor-btn"
              >
                <Briefcase className="w-5 h-5" />
                Contractor
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => update("name", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="John Smith"
                  required
                  data-testid="reg-name-input"
                />
              </div>
            )}

            {mode === "register" && role === "contractor" && (
              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={e => update("company_name", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="Smith Construction LLC"
                  data-testid="reg-company-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Email Address *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update("email", e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                placeholder="john@example.com"
                required
                data-testid="auth-email-input"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => update("phone", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="+1 (555) 000-0000"
                  data-testid="reg-phone-input"
                />
              </div>
            )}

            {mode === "register" && role === "crew" && (
              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Primary Trade</label>
                <select
                  value={form.trade}
                  onChange={e => update("trade", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="reg-trade-select"
                >
                  <option value="">Select a trade</option>
                  {TRADES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => update("password", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white pr-10"
                  placeholder="Min 6 characters"
                  required
                  data-testid="auth-password-input"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">Referral Code (optional)</label>
                <input
                  type="text"
                  value={form.referral_code_used}
                  onChange={e => update("referral_code_used", e.target.value.toUpperCase())}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  placeholder="ABC12345"
                  data-testid="reg-referral-input"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0000FF] text-white py-3 rounded-xl font-bold text-base hover:bg-blue-700 transition-colors disabled:opacity-60 mt-2"
              data-testid="auth-submit-btn"
            >
              {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          {/* Admin login hint */}
          {mode === "login" && (
            <p className="text-center text-xs text-slate-400 mt-4">
              Admin? Use your admin credentials to access the platform.
            </p>
          )}

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            {mode === "login" ? (
              <>Don't have an account? <button onClick={() => setMode("register")} className="text-[#0000FF] font-semibold hover:underline" data-testid="switch-to-register">Sign up free</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode("login")} className="text-[#0000FF] font-semibold hover:underline" data-testid="switch-to-login">Log in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
