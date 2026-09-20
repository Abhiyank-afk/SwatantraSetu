const configuredApiBase = import.meta.env.VITE_API_URL;
const API_BASE = (configuredApiBase || (import.meta.env.DEV ? '/api' : 'https://swatantrasetu.onrender.com/api')).replace(/\/+$/, '');

async function request(path, options = {}) {
  const token = localStorage.getItem('cc_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  verifyEmail: (email, otp) => request('/auth/verify-email', { method: 'POST', body: { email, otp } }),
  resendOtp: (email) => request('/auth/resend-otp', { method: 'POST', body: { email } }),
  me: () => request('/auth/me'),
  workers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workers${qs ? `?${qs}` : ''}`);
  },
  worker: (id) => request(`/workers/${id}`),
  updateAvailability: (id, availability) =>
    request(`/workers/${id}/availability`, { method: 'PATCH', body: { availability } }),
  earnings: (id) => request(`/workers/${id}/earnings`),
  bookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bookings${qs ? `?${qs}` : ''}`);
  },
  createBooking: (payload) => request('/bookings', { method: 'POST', body: payload }),
  updateBookingStatus: (id, status, offline = false) =>
    request(`/bookings/${id}/status`, { method: 'PATCH', body: { status, offline } }),
  syncBookings: () => request('/bookings/sync', { method: 'POST', body: {} }),
  invoice: (id) => request(`/bookings/${id}/invoice`),
  services: () => request('/services'),
  cooperatives: () => request('/cooperatives'),
  cooperative: (id) => request(`/cooperatives/${id}`),
  notifications: () => request('/notifications'),
  impact: () => request('/impact'),
  syncStatus: () => request('/sync-status'),
  coopAnalytics: () => request('/analytics/cooperative'),
  federationAnalytics: () => request('/analytics/federation'),
  aiMatch: (payload) => request('/ai/match', { method: 'POST', body: payload }),
  aiChat: (message, lang) => request('/ai/chat', { method: 'POST', body: { message, lang } }),
  smsFallback: (payload) => request('/sms/fallback', { method: 'POST', body: payload }),
};
