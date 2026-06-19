import axios from "axios";
import { supabase } from "./supabase";
import { makeAuthInterceptor } from "./authHeader";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Pull the freshest access token straight from the Supabase session on every
// request. getSession() reads the persisted session and lets supabase-js refresh
// an expired token transparently, so the backend always receives a valid JWT.
const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

// Injects `Authorization: Bearer <token>` into every Axios request so the recruiter
// can reach the RBAC-protected FastAPI routes (jobs, candidate upload, etc.).
api.interceptors.request.use(makeAuthInterceptor(getAccessToken));

export const Jobs = {
  list: () => api.get("/jobs").then((r) => r.data),
  create: (payload) => api.post("/jobs", payload).then((r) => r.data),
  get: (id) => api.get(`/jobs/${id}`).then((r) => r.data),
};

export const Candidates = {
  get: (id) => api.get(`/candidates/${id}`).then((r) => r.data),
  byJob: (jobId) => api.get(`/candidates/by-job/${jobId}`).then((r) => r.data),
  // Recruiter review queue: only Agent-5-graded candidates, scoped to this recruiter.
  graded: () => api.get("/candidates/graded").then((r) => r.data),
  // Zero-Click self-onboarding: candidate uploads their own resume to the global pool.
  uploadMyResume: (form) =>
    api
      .post("/candidates/me/resume", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
  // HITL recruiter overrides — each returns the updated candidate record.
  hire: (id) => api.post(`/candidates/${id}/hire`).then((r) => r.data),
  reject: (id) => api.post(`/candidates/${id}/reject`).then((r) => r.data),
};

export const Interviews = {
  start: (candidateId) =>
    api.post(`/interviews/${candidateId}/start`).then((r) => r.data),
  end: (candidateId, body) =>
    api.post(`/interviews/${candidateId}/complete`, body).then((r) => r.data),
  getWebRtcToken: (candidateId) =>
    api.get(`/interviews/${candidateId}/webrtc-token`).then((r) => r.data),
  // Phase 4 room flow: resolves ?room=<UUID> -> { token, model, candidate_id }.
  getWebRtcTokenByRoom: (roomId) =>
    api.get(`/interviews/webrtc-token`, { params: { room_id: roomId } }).then((r) => r.data),
  // Single-Write code submission: backend persists then forwards to the live model.
  submitCode: (candidateId, payload) =>
    api.post(`/interviews/${candidateId}/code`, payload).then((r) => r.data),
};
