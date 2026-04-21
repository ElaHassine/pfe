import { Platform } from 'react-native';

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:4001',
  ios: 'http://localhost:4001',
  default: 'http://localhost:4001',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

const DOCTOR_TOKEN_KEY = 'lesio.doctor.token';
let authToken = typeof window !== 'undefined' ? window.localStorage?.getItem(DOCTOR_TOKEN_KEY) || null : null;

export function setAuthToken(token) {
  authToken = token || null;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (authToken) {
      window.localStorage.setItem(DOCTOR_TOKEN_KEY, authToken);
    } else {
      window.localStorage.removeItem(DOCTOR_TOKEN_KEY);
    }
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

export const doctorPortalApi = {
  getDashboard: () => request('/api/doctor/dashboard'),
  listCases: () => request('/api/doctor/cases'),
  getCaseById: (id) => request(`/api/doctor/cases/${id}`),
  listPatients: () => request('/api/doctor/patients'),
  getPatientHistory: (patientId) => request(`/api/doctor/patients/${patientId}/history`),
  getNotifications: () => request('/api/doctor/notifications'),
  listReviews: () => request('/api/doctor/reviews'),
  heartbeatPresence: () => request('/api/doctor/presence/heartbeat', { method: 'POST' }),
  setOfflinePresence: () => request('/api/doctor/presence/offline', { method: 'POST' }),
  listChatThreads: () => request('/api/doctor/chat/threads'),
  getChatMessages: (threadId) => request(`/api/doctor/chat/threads/${threadId}/messages`),
  sendChatMessage: (threadId, body) => request(`/api/doctor/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: { body },
  }),
  respondBookingRequest: (requestId, action) => request(`/api/bookings/doctor/${requestId}/respond`, {
    method: 'PATCH',
    body: { action },
  }),
  suggestBookingTime: (requestId, suggestedTime, doctorNote = '', scheduledAt = '') => request(`/api/bookings/doctor/${requestId}/suggest-time`, {
    method: 'PATCH',
    body: { suggestedTime, doctorNote, scheduledAt },
  }),
  listAppointments: () => request('/api/doctor/appointments'),
  createAppointment: (payload) => request('/api/doctor/appointments', { method: 'POST', body: payload }),
  updateAppointmentDetails: (appointmentId, payload) => request(`/api/doctor/appointments/${appointmentId}/details`, {
    method: 'PATCH',
    body: payload,
  }),
};

export const doctorAuthApi = {
  register: (payload) => request('/api/doctor/auth/register', { method: 'POST', body: payload }),
  login: ({ email, password }) => request('/api/doctor/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/doctor/auth/me'),
  updateMe: (payload) => request('/api/doctor/auth/me', { method: 'PATCH', body: payload }),
  resetPassword: ({ email, newPassword }) => request('/api/doctor/auth/reset-password', { method: 'POST', body: { email, newPassword } }),
};
