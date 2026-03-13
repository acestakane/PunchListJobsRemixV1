import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Briefcase, DollarSign, TrendingUp, Shield, Settings, FileText, Edit, Trash2, Check, X, Search, ChevronLeft, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = ["Overview", "Users", "Jobs", "Payments", "Settings", "Terms"];

const PIE_COLORS = ["#0000FF", "#7EC8E3", "#10B981", "#F59E0B"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Overview");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [terms, setTerms] = useState({ content: "" });
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [editSettings, setEditSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    const res = await axios.get(`${API}/admin/analytics`);
    setAnalytics(res.data);
  }, []);

  const fetchUsers = useCallback(async (page = 1, search = "") => {
    const params = new URLSearchParams({ page, limit: 15 });
    if (search) params.append("search", search);
    const res = await axios.get(`${API}/admin/users?${params}`);
    setUsers(res.data.users);
    setUserTotal(res.data.total);
  }, []);

  const fetchJobs = useCallback(async () => {
    const res = await axios.get(`${API}/admin/jobs`);
    setJobs(res.data.jobs || []);
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await axios.get(`${API}/admin/settings`);
    setSettings(res.data);
    setEditSettings(res.data);
  }, []);

  const fetchTerms = useCallback(async () => {
    const res = await axios.get(`${API}/admin/terms`);
    setTerms(res.data);
  }, []);

  const fetchPayments = useCallback(async () => {
    const res = await axios.get(`${API}/admin/payments`);
    setPayments(res.data);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await fetchAnalytics();
        if (tab === "Users") await fetchUsers(userPage, userSearch);
        if (tab === "Jobs") await fetchJobs();
        if (tab === "Settings") await fetchSettings();
        if (tab === "Terms") await fetchTerms();
        if (tab === "Payments") await fetchPayments();
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [tab, userPage]);

  const suspendUser = async (userId, isActive) => {
    await axios.post(`${API}/admin/users/${userId}/${isActive ? "suspend" : "activate"}`);
    toast.success(isActive ? "User suspended" : "User activated");
    fetchUsers(userPage, userSearch);
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    await axios.delete(`${API}/admin/users/${userId}`);
    toast.success("User deleted");
    fetchUsers(userPage, userSearch);
  };

  const saveSettings = async () => {
    await axios.put(`${API}/admin/settings`, editSettings);
    toast.success("Settings saved");
    setSettings(editSettings);
  };

  const saveTerms = async () => {
    await axios.put(`${API}/admin/terms`, { content: terms.content });
    toast.success("Terms updated");
  };

  const statCards = analytics ? [
    { label: "Total Users", value: analytics.total_users, icon: Users, color: "#0000FF", bg: "#EEF2FF" },
    { label: "Active Jobs", value: analytics.active_jobs, icon: Briefcase, color: "#10B981", bg: "#ECFDF5" },
    { label: "Completed Jobs", value: analytics.completed_jobs, icon: TrendingUp, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Revenue", value: `$${analytics.total_revenue?.toFixed(2)}`, icon: DollarSign, color: "#8B5CF6", bg: "#F5F3FF" },
  ] : [];

  const pieData = analytics ? [
    { name: "Crew", value: analytics.crew_count },
    { name: "Contractors", value: analytics.contractor_count },
    { name: "Active Sub", value: analytics.active_subscriptions },
    { name: "Trial", value: analytics.trial_subscriptions },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>Admin Dashboard</h1>
            <p className="text-slate-500 text-sm">Platform management & analytics</p>
          </div>
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="text-red-600 font-semibold text-sm">Admin</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${tab === t ? "bg-[#050A30] text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              data-testid={`admin-tab-${t.toLowerCase()}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "Overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map(card => (
                <div key={card.label} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-500">{card.label}</span>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>User Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>Recent Users</h3>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {analytics?.recent_users?.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                      <div className="w-8 h-8 bg-[#0000FF] rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#050A30] dark:text-white truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{u.role}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.subscription_status === "trial" ? "bg-blue-100 text-blue-700" : u.subscription_status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {u.subscription_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "Users" && (
          <div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search users..." value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); fetchUsers(1, e.target.value); }}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="admin-user-search" />
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">User</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Role</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Subscription</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Points</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid={`admin-user-row-${u.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#050A30] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#050A30] dark:text-white">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-semibold">{u.role}</span></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {u.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td className="px-4 py-3"><span className="text-xs capitalize">{u.subscription_status}</span></td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold">{u.points || 0}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => suspendUser(u.id, u.is_active)}
                              className={`p-1.5 rounded ${u.is_active ? "text-red-500 hover:bg-red-50" : "text-green-500 hover:bg-green-50"}`}
                              title={u.is_active ? "Suspend" : "Activate"} data-testid={`admin-${u.is_active ? "suspend" : "activate"}-${u.id}`}>
                              {u.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50" title="Delete" data-testid={`admin-delete-user-${u.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500">Showing {users.length} of {userTotal} users</p>
                <div className="flex gap-2">
                  <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1} className="p-1.5 rounded border border-slate-200 disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm">{userPage}</span>
                  <button onClick={() => setUserPage(p => p + 1)} disabled={userPage * 15 >= userTotal} className="p-1.5 rounded border border-slate-200 disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "Settings" && settings && (
          <div className="card p-6 max-w-xl">
            <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-5" style={{ fontFamily: "Manrope, sans-serif" }}>Subscription Pricing</h3>
            <div className="space-y-4 mb-6">
              {[["daily_price", "Daily Pass Price ($)"], ["weekly_price", "Weekly Pass Price ($)"], ["monthly_price", "Monthly Pass Price ($)"]].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">{label}</label>
                  <input type="number" step="0.01" value={editSettings[key] || ""}
                    onChange={e => setEditSettings(s => ({ ...s, [key]: parseFloat(e.target.value) }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid={`settings-${key}`} />
                </div>
              ))}
              {[["trial_days", "Free Trial Duration (days)"], ["job_visibility_hours", "Completed Job Visibility (hours)"]].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-[#050A30] dark:text-white mb-1.5">{label}</label>
                  <input type="number" value={editSettings[key] || ""}
                    onChange={e => setEditSettings(s => ({ ...s, [key]: parseInt(e.target.value) }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                    data-testid={`settings-${key}`} />
                </div>
              ))}
            </div>
            <button onClick={saveSettings} className="bg-[#0000FF] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors" data-testid="save-settings-btn">
              Save Settings
            </button>
          </div>
        )}

        {/* Terms Tab */}
        {tab === "Terms" && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5 text-[#0000FF]" />
              <h3 className="font-bold text-[#050A30] dark:text-white text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>Terms & Conditions</h3>
            </div>
            <textarea
              value={terms.content}
              onChange={e => setTerms(t => ({ ...t, content: e.target.value }))}
              className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-4 text-sm dark:bg-slate-800 dark:text-white min-h-96 focus:outline-none focus:border-[#0000FF]"
              placeholder="Enter your terms and conditions..."
              data-testid="terms-editor"
            />
            <button onClick={saveTerms} className="mt-4 bg-[#0000FF] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700" data-testid="save-terms-btn">
              Save Terms
            </button>
          </div>
        )}

        {/* Payments Tab */}
        {tab === "Payments" && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Plan</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs">{p.id?.slice(0, 8)}</td>
                      <td className="px-4 py-3 font-bold">${p.amount?.toFixed(2)}</td>
                      <td className="px-4 py-3 capitalize">{p.plan}</td>
                      <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No payments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
