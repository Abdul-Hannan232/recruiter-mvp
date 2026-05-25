import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

export const Jobs = {
  list: () => api.get("/jobs").then((r) => r.data),
  create: (payload) => api.post("/jobs", payload).then((r) => r.data),
  get: (id) => api.get(`/jobs/${id}`).then((r) => r.data),
};

export const Candidates = {
  upload: (form) =>
    api
      .post("/candidates/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
  get: (id) => api.get(`/candidates/${id}`).then((r) => r.data),
  byJob: (jobId) => api.get(`/candidates/by-job/${jobId}`).then((r) => r.data),
};

export const Interviews = {
  start: (candidateId) =>
    api.post(`/interviews/${candidateId}/start`).then((r) => r.data),
  end: (candidateId, body) =>
    api.post(`/interviews/${candidateId}/end`, body).then((r) => r.data),
};

export const Realtime = {
  session: (candidateId) =>
    api.post(`/realtime/sessions/${candidateId}`).then((r) => r.data),
};
