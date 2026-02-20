"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, MailX, RefreshCw } from "lucide-react";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface AppConfig {
  emailRemindersEnabled: boolean;
}

interface Props {
  onToast: (type: "success" | "error", message: string) => void;
}

export function GlobalSettingsPanel({ onToast }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken()!;
      const data = await apiFetch<{ config: AppConfig }>("/admin/config", { token });
      setConfig(data.config);
    } catch (err: any) {
      onToast("error", err.message || "Failed to load global settings");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const toggle = async (key: keyof AppConfig, value: boolean) => {
    if (!config || saving) return;
    setSaving(true);
    const prev = config[key];
    setConfig((c) => c ? { ...c, [key]: value } : c);
    try {
      const token = getToken()!;
      const data = await apiFetch<{ config: AppConfig }>("/admin/config", {
        token,
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setConfig(data.config);
      onToast("success", `Email reminders ${value ? "enabled" : "disabled"} globally`);
    } catch (err: any) {
      setConfig((c) => c ? { ...c, [key]: prev } : c);
      onToast("error", err.message || "Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-2 border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Global Settings</h2>
        <button
          onClick={loadConfig}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading settings...</div>
      ) : config ? (
        <div className="space-y-3">
          {/* Email Reminders Toggle */}
          <div className="flex items-center justify-between border border-line rounded-xl px-4 py-3 bg-card">
            <div className="flex items-center gap-3">
              {config.emailRemindersEnabled
                ? <Mail className="w-5 h-5 text-green-600 shrink-0" />
                : <MailX className="w-5 h-5 text-red-500 shrink-0" />
              }
              <div>
                <p className="font-semibold text-sm">Email Reminders</p>
                <p className="text-xs text-gray-500">
                  {config.emailRemindersEnabled
                    ? "Daily reminder emails are being sent to users who have them enabled."
                    : "All reminder emails are globally paused — no emails will be sent regardless of user settings."}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggle("emailRemindersEnabled", !config.emailRemindersEnabled)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                config.emailRemindersEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={config.emailRemindersEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  config.emailRemindersEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-red-500 py-2">Failed to load settings.</div>
      )}
    </section>
  );
}
