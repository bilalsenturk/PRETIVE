"use client";

import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { supabase } from "@/lib/supabase";
import { Loader2, Check, Eye, EyeOff, AlertTriangle, Download, Shield } from "lucide-react";
import { get } from "@/lib/api";

export default function SecuritySettings() {
  const { user, loading: userLoading } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleChangePassword = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authError) throw authError;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setToast("Password updated successfully");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/me`, {
        method: "DELETE",
        headers: { "x-user-id": user.id },
      });
      if (!res.ok) throw new Error("Failed to delete account");
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">
          <Check size={16} />
          {toast}
        </div>
      )}

      {/* Change Password */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Change Password
        </h2>

        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 rounded-xl bg-[#D94228] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#C13920] disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Update Password
          </button>
        </div>
      </div>

      {/* Data Privacy (GDPR) */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <Shield size={20} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Data Privacy</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage your personal data. Under GDPR, you have the right to access, export, and delete your data.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={async () => {
              setExporting(true);
              try {
                const data = await get("/api/me/export");
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pretive-data-export-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setToast("Data exported successfully");
                setTimeout(() => setToast(null), 3000);
              } catch {
                setError("Failed to export data");
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export My Data (JSON)
          </button>

          <div className="flex gap-3 text-xs text-gray-400">
            <a href="/privacy" target="_blank" className="underline hover:text-gray-600">Privacy Policy</a>
            <a href="/dpa" target="_blank" className="underline hover:text-gray-600">Data Processing Agreement</a>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
            <p className="text-sm text-gray-500 mt-1">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
          </div>
        </div>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Delete Account
          </button>
        ) : (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700 mb-3">
              Are you absolutely sure? This will permanently delete your account,
              all sessions, and organization data.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                Yes, delete my account
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
