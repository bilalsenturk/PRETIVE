"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/user-context";
import { Loader2, Check, Building2, Trash2 } from "lucide-react";

const industries = ["Education", "Technology", "Healthcare", "Finance", "Other"];
const sizes = ["1-10", "11-50", "51-200", "201-500", "500+"];

interface Organization {
  id: string;
  name: string;
  slug: string;
  website: string;
  industry: string;
  size: string;
}

export default function OrganizationSettings() {
  const { user, loading: userLoading } = useUser();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    website: "",
    industry: "Technology",
    size: "1-10",
  });

  useEffect(() => {
    if (!user) return;
    const fetchOrg = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/organization`,
          { headers: { "x-user-id": user.id } }
        );
        if (res.ok) {
          const data = await res.json();
          setOrg(data);
          setForm({
            name: data.name || "",
            slug: data.slug || "",
            website: data.website || "",
            industry: data.industry || "Technology",
            size: data.size || "1-10",
          });
        }
      } catch (e) {
        console.error("Failed to fetch org:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/organization`,
        {
          method: org ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id,
          },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error("Failed to save organization");
      const data = await res.json();
      setOrg(data);
      setToast(org ? "Organization updated" : "Organization created");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !org) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/organization`,
        {
          method: "DELETE",
          headers: { "x-user-id": user.id },
        }
      );
      setOrg(null);
      setForm({ name: "", slug: "", website: "", industry: "Technology", size: "1-10" });
      setConfirmDelete(false);
      setToast("Organization deleted");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  if (userLoading || loading) {
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

      {!org ? (
        /* Create Organization */
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Building2 size={24} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Create Your Organization
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Set up your organization to manage team members and settings.
          </p>

          <div className="mx-auto max-w-md space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                placeholder="Acme Inc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Slug
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                placeholder="acme-inc"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.slug}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D94228] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#C13920] disabled:opacity-50"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Create Organization
            </button>
          </div>
        </div>
      ) : (
        /* Edit Organization */
        <>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Organization Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, website: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Industry
                </label>
                <select
                  value={form.industry}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, industry: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company Size
                </label>
                <select
                  value={form.size}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, size: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-[#D94228] focus:outline-none focus:ring-1 focus:ring-[#D94228]"
                >
                  {sizes.map((s) => (
                    <option key={s} value={s}>
                      {s} employees
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#D94228] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#C13920] disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-red-600 mb-2">
              Danger Zone
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Deleting your organization is permanent and cannot be undone.
            </p>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 size={16} />
                Delete Organization
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Yes, delete permanently
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
