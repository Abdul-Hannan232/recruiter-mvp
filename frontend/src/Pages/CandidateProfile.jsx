import { useRef, useState } from "react";
import { User, MapPin, Mail, FileText, UploadCloud, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import { Candidates } from "../services/api.js";

const ACCEPT = ".pdf,.docx";

export default function CandidateProfile() {
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};

  const [fullName, setFullName] = useState(meta.full_name ?? "");
  const [city, setCity] = useState(meta.city ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [saveErr, setSaveErr] = useState(null);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const inputRef = useRef(null);

  async function saveProfile(e) {
    e.preventDefault();
    setSaveErr(null);
    setSavedMsg(null);
    if (!fullName.trim() || !city.trim()) {
      setSaveErr("Full name and city are required.");
      return;
    }
    setSaving(true);
    // 1) Persist to Supabase Auth user_metadata — the JWT (and therefore the backend's
    //    auth-level location binding) picks this up on the next request.
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim(), city: city.trim() },
    });
    if (error) {
      setSaving(false);
      setSaveErr(error.message);
      return;
    }

    // 2) Immediately push the same state to the FastAPI DB so the Candidate row never
    //    drifts from the JWT (Agent 2's geo-gate reads the DB city). If this fails the
    //    auth metadata is already updated, so surface the partial state and ask to retry.
    try {
      await Candidates.updateProfile({ full_name: fullName.trim(), city: city.trim() });
      setSavedMsg("Profile updated.");
    } catch (err) {
      setSaveErr(
        `Saved to your account, but syncing to our servers failed: ${
          err?.response?.data?.detail ?? err.message
        }. Please retry.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function reupload() {
    if (!file || uploading) return;
    setUploading(true);
    setUploadErr(null);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await Candidates.uploadMyResume(fd); // re-triggers Agent 1 (parse + embed + pool)
      setUploadMsg("Resume re-uploaded — Agent 1 is re-processing your profile.");
      setFile(null);
    } catch (err) {
      setUploadErr(err?.response?.data?.detail ?? err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-1 text-slate-500">Manage your details and resume in the talent pool.</p>
        </div>

        {/* Identity + edit form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-900 text-white">
              <User size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{meta.full_name || "Candidate"}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail size={14} /> {user?.email ?? "—"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={14} /> {meta.city || "Location unknown"}
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Your city"
              />
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
              <Save size={16} /> {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>

        {/* Resume status + re-upload */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText size={18} className="text-indigo-500" /> Resume
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 size={13} /> Active in Talent Pool
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Re-upload to refresh your profile — this re-runs Agent 1 (parse + embed) on your
            latest resume.
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            className="mt-5 cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-indigo-400"
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <UploadCloud className="mx-auto mb-2 text-slate-400" size={28} />
            {file ? (
              <p className="font-medium text-slate-900">{file.name}</p>
            ) : (
              <p className="text-sm text-slate-500">Click to choose a new PDF or DOCX</p>
            )}
          </div>

          {uploadErr && <p className="mt-3 text-sm text-rose-600">{uploadErr}</p>}
          {uploadMsg && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} /> {uploadMsg}
            </p>
          )}

          <button
            onClick={reupload}
            disabled={!file || uploading}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <UploadCloud size={16} /> {uploading ? "Uploading…" : "Re-upload resume"}
          </button>
        </div>
      </div>
    </div>
  );
}
