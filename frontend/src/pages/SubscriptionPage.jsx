import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import axios from "axios";
import { CheckCircle, Clock, Zap, Calendar, CreditCard, Shield, Star, DollarSign } from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PAYPAL_CLIENT_ID = "Ab9_cJrFPsrzDH5LL6A_H15k4I4oiPA1eOaKHzOI-hcwLrwyvL4sArjnqO24I_WX94RQzAlSUhHAGtsg";

const PLAN_ICONS = { daily: Clock, weekly: Calendar, monthly: Zap, annual: Star };
const PLAN_COLORS = { daily: "#10B981", weekly: "#0000FF", monthly: "#7C3AED", annual: "#F59E0B" };
const TRIAL_INFO = {
  monthly: { days: 30, label: "30-day free trial" },
  annual: { days: 180, label: "6-month free trial" },
};

export default function SubscriptionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState({});
  const [selected, setSelected] = useState("monthly");
  const [method, setMethod] = useState("square");
  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cashappInfo, setCashappInfo] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const methodParam = searchParams.get("method");
    const planParam = searchParams.get("plan");
    const orderId = searchParams.get("order_id");
    const userId = searchParams.get("user_id");

    if (sessionId && methodParam === "stripe") {
      pollStripeStatus(sessionId, 0);
    }
    if (methodParam === "paypal" && planParam) {
      const ppOrderId = searchParams.get("token");
      if (ppOrderId) capturePayPal(ppOrderId, planParam);
    }
    if (methodParam === "square" && orderId && planParam) {
      checkSquareStatus(orderId, planParam, userId || user?.id);
    }
  }, [searchParams]);

  const pollStripeStatus = async (sessionId, attempts) => {
    if (attempts > 6) { toast.error("Payment status check timed out"); return; }
    try {
      const res = await axios.get(`${API}/payments/stripe/status/${sessionId}`);
      if (res.data.payment_status === "paid") {
        toast.success("Payment successful! Subscription activated.");
        await refreshUser(); navigate("/subscription");
      } else if (res.data.status === "expired") {
        toast.error("Payment expired. Please try again.");
      } else {
        setTimeout(() => pollStripeStatus(sessionId, attempts + 1), 2000);
      }
    } catch { }
  };

  const capturePayPal = async (orderId, plan) => {
    try {
      await axios.post(`${API}/payments/paypal/capture/${orderId}?plan=${plan}`);
      toast.success("Payment successful! Subscription activated.");
      await refreshUser(); navigate("/subscription");
    } catch { toast.error("Failed to capture payment"); }
  };

  const checkSquareStatus = async (orderId, plan, userId) => {
    try {
      const res = await axios.get(`${API}/payments/square/status/${orderId}?plan=${plan}&user_id=${userId || ""}`);
      if (res.data.status === "COMPLETED") {
        toast.success("CashApp/Square payment successful! Subscription activated.");
        await refreshUser(); navigate("/subscription");
      } else {
        toast.info("Payment is being processed. Refresh in a moment.");
      }
    } catch { toast.error("Could not verify Square payment."); }
  };

  useEffect(() => {
    const load = async () => {
      const [plansRes, statusRes] = await Promise.all([
        axios.get(`${API}/payments/plans`),
        axios.get(`${API}/payments/subscription/status`),
      ]);
      setPlans(plansRes.data);
      setSubStatus(statusRes.data);
    };
    load().catch(console.error);
  }, [user]);

  const initiateStripe = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/payments/stripe/create-session`, {
        plan: selected, payment_method: "stripe", origin_url: window.location.origin
      });
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create payment session");
    } finally { setLoading(false); }
  };

  const initiateSquare = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/payments/square/create-link`, {
        plan: selected, payment_method: "square", origin_url: window.location.origin
      });
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create Square payment link");
    } finally { setLoading(false); }
  };

  const createPayPalOrder = async () => {
    const res = await axios.post(`${API}/payments/paypal/create-order`, {
      plan: selected, payment_method: "paypal", origin_url: window.location.origin
    });
    return res.data.order_id;
  };

  const onPayPalApprove = async (data) => {
    try {
      await axios.post(`${API}/payments/paypal/capture/${data.orderID}?plan=${selected}`);
      toast.success("Payment successful! Subscription activated.");
      await refreshUser(); navigate("/subscription");
    } catch { toast.error("Failed to capture payment"); }
  };

  const selectedPlan = plans[selected];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#050A30] dark:text-white mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            Choose Your Plan
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Full platform access. Cancel anytime.</p>
        </div>

        {subStatus && (
          <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
            subStatus.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200" :
            subStatus.status === "trial" ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200" :
            "bg-red-50 dark:bg-red-900/20 border border-red-200"}`}>
            {subStatus.status === "active" ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" /> :
             subStatus.status === "trial" ? <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" /> :
             <Shield className="w-5 h-5 text-red-500 flex-shrink-0" />}
            <div>
              <p className="font-semibold text-sm">
                {subStatus.status === "active" && `Active ${subStatus.plan || ""} subscription`}
                {subStatus.status === "trial" && `Free trial: ${subStatus.days_remaining} days remaining`}
                {subStatus.status === "expired" && "Your subscription has expired. Renew to continue."}
              </p>
              {subStatus.subscription_end && (
                <p className="text-xs text-slate-500">
                  {subStatus.status === "active" ? "Renews" : "Expires"}: {new Date(subStatus.subscription_end).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {Object.entries(plans).map(([key, plan]) => {
            const Icon = PLAN_ICONS[key] || Clock;
            const color = PLAN_COLORS[key] || "#0000FF";
            const isSelected = selected === key;
            const period = key === "daily" ? "day" : key === "weekly" ? "wk" : key === "monthly" ? "mo" : "yr";
            return (
              <button key={key} onClick={() => setSelected(key)}
                className={`relative p-4 rounded-2xl border-2 text-left transition-all ${isSelected ? "border-[#0000FF] bg-blue-50 dark:bg-blue-950 shadow-lg" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300"}`}
                data-testid={`plan-${key}`}>
                {key === "annual" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">Best Value</span>
                )}
                {key === "monthly" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0000FF] text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">Popular</span>
                )}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}20` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="font-extrabold text-[#050A30] dark:text-white capitalize text-sm" style={{ fontFamily: "Manrope, sans-serif" }}>{key}</div>
                <div className="text-xl font-extrabold mt-0.5" style={{ color }}>
                  ${plan.amount}
                  <span className="text-xs font-normal text-slate-500">/{period}</span>
                </div>
                {isSelected && <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-[#0000FF]" />}
              </button>
            );
          })}
        </div>

        {/* Payment Method + Action */}
        <div className="card p-6 max-w-lg mx-auto">
          <h3 className="font-bold text-[#050A30] dark:text-white mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
            Pay {selectedPlan ? `$${selectedPlan.amount}` : ""} — {selected} access
          </h3>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <button onClick={() => setMethod("square")}
              className={`py-2.5 rounded-lg font-bold text-xs border-2 transition-colors ${method === "square" ? "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}
              data-testid="method-square">CashApp Pay</button>
            <button onClick={() => setMethod("paypal")}
              className={`py-2.5 rounded-lg font-bold text-xs border-2 transition-colors ${method === "paypal" ? "border-[#0070BA] bg-[#0070BA]/10 text-[#003087]" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}
              data-testid="method-paypal">PayPal</button>
            <button onClick={() => setMethod("stripe")}
              className={`py-2.5 rounded-lg font-bold text-xs border-2 transition-colors ${method === "stripe" ? "border-[#635BFF] bg-[#635BFF]/10 text-[#635BFF]" : "border-slate-200 dark:border-slate-700 text-slate-500"}`}
              data-testid="method-stripe">Card</button>
          </div>

          {method === "square" && (
            <button onClick={initiateSquare} disabled={loading}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="square-pay-btn">
              {loading ? "Redirecting to Square..." : `Pay $${selectedPlan?.amount || ""} with CashApp/Square`}
            </button>
          )}
          {method === "paypal" && (
            <PayPalScriptProvider options={{ "client-id": PAYPAL_CLIENT_ID, currency: "USD" }}>
              <PayPalButtons style={{ layout: "vertical", shape: "rect", label: "pay" }}
                createOrder={createPayPalOrder} onApprove={onPayPalApprove}
                onError={() => toast.error("PayPal error. Please try again.")}
                data-testid="paypal-buttons" />
            </PayPalScriptProvider>
          )}
          {method === "stripe" && (
            <button onClick={initiateStripe} disabled={loading}
              className="w-full bg-[#635BFF] text-white py-3.5 rounded-xl font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="stripe-pay-btn">
              <CreditCard className="w-5 h-5" />
              {loading ? "Redirecting..." : `Pay $${selectedPlan?.amount || ""} with Card`}
            </button>
          )}

          <div className="flex items-center justify-center gap-2 mt-4 text-slate-400 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure encrypted payments. Cancel anytime.</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["Full access to live job map","Real-time job notifications","AI-powered job matching","Unlimited job applications","Ratings & reputation building","Priority support"].map(f => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-400">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
