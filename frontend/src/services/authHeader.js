// Pure, dependency-free Axios request interceptor factory.
//
// Kept separate from supabase.js / api.js (which need Vite env + the live client)
// so the header-injection logic can be unit-tested in plain Node. Given an async
// token getter, it returns an interceptor that attaches `Authorization: Bearer <jwt>`
// when a token is present and otherwise leaves the request untouched.
export function makeAuthInterceptor(getToken) {
  return async (config) => {
    const token = await getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  };
}
