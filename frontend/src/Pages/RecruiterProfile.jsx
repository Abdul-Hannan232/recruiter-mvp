import { useState } from "react";
import { Building2, Mail, ShieldCheck, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";

export default function RecruiterProfile() {
  const { user, userRole } = useAuth();
  const meta = user?.user_metadata ?? {};

  const [fullName, setFullName] = useState(meta.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);

  async function saveProfile(e) {
    e.preventDefault();
    setSaveErr(null);
    setSavedMsg(null);
    if (!fullName.trim()) {
      setSaveErr("Full name is required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });
    setSaving(false);
    if (error) setSaveErr(error.message);
    else setSavedMsg("Settings saved.");
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">Manage your recruiter account details.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-900 text-white">
              <Building2 size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meta.full_name || "Recruiter"}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail size={14} /> {user?.email ?? "—"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                <ShieldCheck size={14} /> Role: {userRole ? userRole[0].toUpperCase() + userRole.slice(1) : "Recruiter"}
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="mt-6 space-y-4 border-t border-slate-200 pt-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
              <input
                value={user?.email ?? ""}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">Email is managed by your authentication provider.</p>
            </div>

            {saveErr && <p className="text-sm text-rose-600">{saveErr}</p>}
            {savedMsg && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 size={15} /> {savedMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "Saving…" : "Save settings"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
