import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import {
  Camera, MapPin, Navigation, CheckCircle, ArrowRight, X, Upload, ToggleLeft, ToggleRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "thedaylaborers_onboarding_done";

export default function OnboardingModal({ onClose }) {
  const { user, refreshUser, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState(user?.address || user?.location?.address || "");
  const [savingAddress, setSavingAddress] = useState(false);
  const [isOnline, setIsOnline] = useState(user?.is_online ?? false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const fileRef = useRef(null);

  const markDone = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewPhoto(ev.target.result);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/users/upload-photo`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      updateUser({ profile_photo: res.data.url, logo: res.data.url });
      toast.success("Photo uploaded!");
      await refreshUser();
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const saveAddress = async () => {
    if (!address.trim()) { toast.error("Please enter your address"); return; }
    setSavingAddress(true);
    try {
      await axios.put(`${API}/users/profile`, { address: address.trim() });
      updateUser({ address: address.trim() });
      toast.success("Address saved and geocoded!");
      await refreshUser();
    } catch {
      toast.error("Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const saveOnlineStatus = async () => {
    try {
      await axios.put(`${API}/users/online-status`, { is_online: isOnline });
      updateUser({ is_online: isOnline, availability: isOnline });
      toast.success(isOnline ? "You're now visible on the map!" : "You're offline (hidden from map)");
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const profilePhoto = previewPhoto || (user?.profile_photo || user?.logo
    ? `${process.env.REACT_APP_BACKEND_URL}${user.profile_photo || user.logo}`
    : null);

  const steps = [
    { num: 1, label: "Upload Photo" },
    { num: 2, label: "Add Address" },
    { num: 3, label: "Map Visibility" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress Header */}
        <div className="bg-[#050A30] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-extrabold text-xl" style={{ fontFamily: "Manrope, sans-serif" }}>
                Welcome to TheDayLaborers!
              </h2>
              <p className="text-[#7EC8E3] text-sm mt-0.5">Complete your profile to appear on the map</p>
            </div>
            <button onClick={markDone} className="text-slate-400 hover:text-white p-1" data-testid="skip-onboarding">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > s.num ? "bg-emerald-500 text-white" :
                    step === s.num ? "bg-[#0000FF] text-white" :
                    "bg-white/20 text-white/50"
                  }`}>
                    {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-medium ${step === s.num ? "text-white" : "text-white/50"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.num ? "bg-emerald-500" : "bg-white/20"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="text-center">
              <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                STEP 1 — Upload Your Photo
              </h3>
              <p className="text-slate-500 text-sm mb-6">Contractors are more likely to hire crew with a profile photo.</p>

              <div className="relative inline-block mb-6">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-4 border-[#7EC8E3]">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-9 h-9 bg-[#0000FF] rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
                  data-testid="onboarding-upload-photo">
                  <Upload className="w-4 h-4 text-white" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {uploading && <p className="text-sm text-blue-500 mb-4">Uploading...</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
                  data-testid="skip-step-1">
                  Skip for now
                </button>
                <button onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700"
                  data-testid="next-step-1">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                STEP 2 — Add Your Address
              </h3>
              <p className="text-slate-500 text-sm mb-4">Your exact address is never shown publicly — only street name and city.</p>

              <div className="relative mb-4">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St, Atlanta, GA 30301"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white"
                  data-testid="onboarding-address-input"
                  onKeyPress={e => e.key === "Enter" && saveAddress()}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 mb-5">
                <strong>Privacy:</strong> We only show street name + city on the map. Your exact address is never visible to other users.
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
                  data-testid="skip-step-2">
                  Skip for now
                </button>
                <button onClick={async () => { await saveAddress(); setStep(3); }}
                  disabled={savingAddress || !address.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
                  data-testid="next-step-2">
                  {savingAddress ? "Saving..." : <><span>Save & Next</span> <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center">
              <h3 className="font-bold text-[#050A30] dark:text-white text-lg mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
                STEP 3 — Enable Map Visibility
              </h3>
              <p className="text-slate-500 text-sm mb-6">Flip the switch to appear on the live job map and get hired.</p>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-left">
                    <p className="font-bold text-[#050A30] dark:text-white">
                      {isOnline ? "LIVE ON MAP" : "OFFLINE"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isOnline ? "Contractors can find and hire you" : "Flip switch to appear on map"}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className={`w-16 h-8 rounded-full flex items-center px-1 transition-colors cursor-pointer ${isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                    data-testid="onboarding-visibility-toggle">
                    <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${isOnline ? "translate-x-8" : ""}`} />
                  </button>
                </div>

                {isOnline && (
                  <div className="flex items-center gap-2 mt-3 text-emerald-600 text-sm font-semibold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    You will appear on the live job map
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={markDone}
                  className="flex-1 py-2.5 border-2 border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-sm font-semibold"
                  data-testid="skip-step-3">
                  Maybe later
                </button>
                <button onClick={async () => { await saveOnlineStatus(); markDone(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0000FF] text-white rounded-xl text-sm font-bold hover:bg-blue-700"
                  data-testid="finish-onboarding">
                  <CheckCircle className="w-4 h-4" /> Finish Setup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
