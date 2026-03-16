import React, { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import {
  Volume2, VolumeX, Bell, BellOff, Vibrate, Briefcase, UserCheck,
  UserX, BarChart2, Save, RotateCcw, Play
} from "lucide-react";

const STORAGE_KEY = "thedaylaborers_app_settings";

const DEFAULT_SETTINGS = {
  soundVolume: 70,
  vibrationAlerts: true,
  browserNotifications: false,
  pushNotifications: false,
  newJobs: true,
  jobAccepted: true,
  jobDeclined: true,
  analyticsData: false,
};

function Toggle({ checked, onChange, testId }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${checked ? "bg-[#0000FF]" : "bg-slate-300 dark:bg-slate-600"}`}
      data-testid={testId}
      role="switch"
      aria-checked={checked}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-0"}`} />
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, children, testId }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0" data-testid={testId}>
      <div className="flex items-start gap-3 flex-1">
        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-[#0000FF]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#050A30] dark:text-white">{label}</p>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="flex-shrink-0 mt-0.5">{children}</div>
    </div>
  );
}

export default function AppSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const audioCtx = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch { }
    }
  }, []);

  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("Settings saved!");

    // Request browser notification permission if enabled
    if (settings.browserNotifications && "Notification" in window) {
      Notification.requestPermission().then(permission => {
        if (permission === "denied") {
          toast.error("Browser notifications blocked. Please allow in browser settings.");
          update("browserNotifications", false);
        }
      });
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    toast.info("Settings reset to defaults.");
  };

  const testSound = () => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(settings.soundVolume / 100, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      toast.success("Sound test played!");
    } catch {
      toast.error("Sound test failed. Check browser permissions.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" style={{ fontFamily: "Inter, sans-serif" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#050A30] dark:text-white" style={{ fontFamily: "Manrope, sans-serif" }}>
            App Settings
          </h1>
          <p className="text-slate-500 text-sm mt-1">Customize your notifications, sounds, and preferences.</p>
        </div>

        {/* Sound */}
        <div className="card p-5 mb-4">
          <h2 className="font-bold text-[#050A30] dark:text-white text-base mb-4 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            <Volume2 className="w-4 h-4 text-[#0000FF]" /> Sound
          </h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-[#050A30] dark:text-white">Alert Volume</label>
              <span className="text-sm font-bold text-[#0000FF]">{settings.soundVolume}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="range" min="0" max="100" value={settings.soundVolume}
                onChange={e => update("soundVolume", Number(e.target.value))}
                className="flex-1 h-2 rounded-full accent-[#0000FF] cursor-pointer"
                data-testid="sound-volume-slider"
              />
              <Volume2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
          </div>

          <button
            onClick={testSound}
            className="flex items-center gap-2 px-4 py-2 border-2 border-[#0000FF] text-[#0000FF] rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
            data-testid="test-sound-btn">
            <Play className="w-4 h-4" /> Test Sound
          </button>
        </div>

        {/* Notifications */}
        <div className="card p-5 mb-4">
          <h2 className="font-bold text-[#050A30] dark:text-white text-base mb-1 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            <Bell className="w-4 h-4 text-[#0000FF]" /> Notifications
          </h2>
          <p className="text-xs text-slate-400 mb-4">Choose how you receive alerts</p>

          <SettingRow
            icon={Vibrate}
            label="Vibration Alerts"
            description="Vibrate your device when alerts arrive (mobile only)"
            testId="vibration-setting">
            <Toggle checked={settings.vibrationAlerts} onChange={v => update("vibrationAlerts", v)} testId="vibration-toggle" />
          </SettingRow>

          <SettingRow
            icon={Bell}
            label="Browser Notifications"
            description="Push notifications that appear even when the app is in the background"
            testId="browser-notifications-setting">
            <Toggle checked={settings.browserNotifications} onChange={v => update("browserNotifications", v)} testId="browser-notifications-toggle" />
          </SettingRow>

          <SettingRow
            icon={Bell}
            label="Push Notifications"
            description="Receive push notifications on your mobile device"
            testId="push-notifications-setting">
            <Toggle checked={settings.pushNotifications} onChange={v => update("pushNotifications", v)} testId="push-notifications-toggle" />
          </SettingRow>
        </div>

        {/* Alert Types */}
        <div className="card p-5 mb-4">
          <h2 className="font-bold text-[#050A30] dark:text-white text-base mb-1 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            <BellOff className="w-4 h-4 text-[#0000FF]" /> Alert Types
          </h2>
          <p className="text-xs text-slate-400 mb-4">Choose which events trigger notifications</p>

          <SettingRow
            icon={Briefcase}
            label="New Jobs"
            description="Get notified when new job postings match your trade"
            testId="new-jobs-setting">
            <Toggle checked={settings.newJobs} onChange={v => update("newJobs", v)} testId="new-jobs-toggle" />
          </SettingRow>

          <SettingRow
            icon={UserCheck}
            label="Job Accepted"
            description="Get notified when a worker accepts your job posting"
            testId="job-accepted-setting">
            <Toggle checked={settings.jobAccepted} onChange={v => update("jobAccepted", v)} testId="job-accepted-toggle" />
          </SettingRow>

          <SettingRow
            icon={UserX}
            label="Job Declined"
            description="Get notified when a worker declines or withdraws from a job"
            testId="job-declined-setting">
            <Toggle checked={settings.jobDeclined} onChange={v => update("jobDeclined", v)} testId="job-declined-toggle" />
          </SettingRow>
        </div>

        {/* Analytics & Privacy */}
        <div className="card p-5 mb-6">
          <h2 className="font-bold text-[#050A30] dark:text-white text-base mb-1 flex items-center gap-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            <BarChart2 className="w-4 h-4 text-[#0000FF]" /> Analytics & Usage Data
          </h2>
          <p className="text-xs text-slate-400 mb-4">Help us improve TheDayLaborers by sharing anonymous usage data</p>

          <SettingRow
            icon={BarChart2}
            label="Share Usage Data"
            description="Anonymously share app usage to help improve the platform experience"
            testId="analytics-setting">
            <Toggle checked={settings.analyticsData} onChange={v => update("analyticsData", v)} testId="analytics-toggle" />
          </SettingRow>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={saveSettings}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0000FF] text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            data-testid="save-settings-btn">
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Settings"}
          </button>
          <button onClick={resetSettings}
            className="flex items-center justify-center gap-2 px-5 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            data-testid="reset-settings-btn">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
