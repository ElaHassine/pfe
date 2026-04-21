import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  ios: 'http://localhost:4000',
  default: 'http://localhost:4000',
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

function getExpoHost() {
  const hostUri =
    Constants?.expoConfig?.hostUri
    || Constants?.manifest2?.extra?.expoClient?.hostUri
    || Constants?.manifest?.debuggerHost
    || '';

  if (!hostUri) return null;
  const host = String(hostUri).split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

function uniqueUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function buildFallbackUrls() {
  const expoHost = getExpoHost();
  const expoHostUrls = expoHost ? [`http://${expoHost}:4000`, `http://${expoHost}:4001`] : [];

  const platformDefaults = Platform.select({
    android: ['http://10.0.2.2:4000', 'http://10.0.2.2:4001'],
    ios: ['http://localhost:4000', 'http://localhost:4001'],
    default: ['http://localhost:4000', 'http://localhost:4001'],
  }) || [];

  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) return uniqueUrls([...expoHostUrls, ...platformDefaults]);

  // When env URL is set, still try same host on port 4001 and local defaults.
  const sameHostAltPort = configured.replace(/:\d+$/, ':4001');
  return uniqueUrls([configured, sameHostAltPort, ...expoHostUrls, ...platformDefaults]);
}

const API_FALLBACK_URLS = buildFallbackUrls();
let activeApiBaseUrl = API_BASE_URL;

let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const candidateBaseUrls = [activeApiBaseUrl, ...(API_FALLBACK_URLS || []).filter((url) => url && url !== activeApiBaseUrl)];

  let response;
  let networkError = null;
  let lastHttpErrorResponse = null;

  for (const baseUrl of candidateBaseUrls) {
    try {
      const currentResponse = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // If this base URL returns 404, try the next candidate before failing.
      if (currentResponse.status === 404) {
        lastHttpErrorResponse = currentResponse;
        continue;
      }

      response = currentResponse;
      activeApiBaseUrl = baseUrl;
      networkError = null;
      break;
    } catch (error) {
      networkError = error;
    }
  }

  if (!response && lastHttpErrorResponse) {
    response = lastHttpErrorResponse;
  }

  if (!response) {
    throw new Error(`Network request failed. Check backend reachability at ${activeApiBaseUrl}. (${networkError?.message || 'unknown error'})`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function requestFormData(path, formData, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const candidateBaseUrls = [activeApiBaseUrl, ...(API_FALLBACK_URLS || []).filter((url) => url && url !== activeApiBaseUrl)];

  let response;
  let networkError = null;
  let lastHttpErrorResponse = null;

  for (const baseUrl of candidateBaseUrls) {
    try {
      const currentResponse = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'POST',
        headers,
        body: formData,
      });

      // If this base URL returns 404, try the next candidate before failing.
      if (currentResponse.status === 404) {
        lastHttpErrorResponse = currentResponse;
        continue;
      }

      response = currentResponse;
      activeApiBaseUrl = baseUrl;
      networkError = null;
      break;
    } catch (error) {
      networkError = error;
    }
  }

  if (!response && lastHttpErrorResponse) {
    response = lastHttpErrorResponse;
  }

  if (!response) {
    throw new Error(`Network request failed. Check backend reachability at ${activeApiBaseUrl}. (${networkError?.message || 'unknown error'})`);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const authApi = {
  register: (data) => request('/api/auth/register', { method: 'POST', body: data }),
  login: ({ email, password }) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  google: ({ email, fullName, avatarUrl }) => request('/api/auth/google', { method: 'POST', body: { email, fullName, avatarUrl } }),
  resetPassword: ({ email, newPassword }) => request('/api/auth/reset-password', { method: 'POST', body: { email, newPassword } }),
  me: () => request('/api/auth/me'),
  updateMe: (payload) => request('/api/auth/me', { method: 'PATCH', body: payload }),
};

export const patientApi = {
  getSummary: () => request('/api/patients/me/summary'),
  getActivityOverview: () => request('/api/patients/me/activity-overview'),
  getActivity: () => request('/api/patients/me/activity'),
  clearActivity: () => request('/api/patients/me/activity', { method: 'DELETE' }),
  deleteActivity: (eventId) => request(`/api/patients/me/activity/${eventId}`, { method: 'DELETE' }),
  getLikedPosts: (patientId) => request(`/api/patients/${patientId}/liked-posts`),
  getAppointments: () => request('/api/bookings/me/appointments'),
  cancelAppointment: (requestId) => {
    const normalizedId = String(requestId || '').trim();
    if (!normalizedId) {
      return Promise.reject(new Error('Appointment ID is missing'));
    }
    return request(`/api/bookings/me/appointments/${normalizedId}/cancel`, { method: 'PATCH' });
  },
};

export const scanApi = {
  list: () => request('/api/scans'),
  create: (payload) => request('/api/scans', { method: 'POST', body: payload }),
  updatePatientNotes: (scanId, patientNotes) => request(`/api/scans/${scanId}/patient-notes`, {
    method: 'PATCH',
    body: { patientNotes },
  }),
};

export const communityApi = {
  listPosts: () => request('/api/community/posts'),
  createPost: (payload) => {
    const imageUri = String(payload?.imageUri || '').trim();
    if (!imageUri) {
      const { imageUri: _unused, ...jsonPayload } = payload || {};
      return request('/api/community/posts', { method: 'POST', body: jsonPayload });
    }

    const fileName = imageUri.split('/').pop() || 'community.jpg';
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: fileName,
      type: mime,
    });
    formData.append('note', String(payload?.note || ''));
    formData.append('diagnosis', String(payload?.diagnosis || ''));
    formData.append('location', String(payload?.location || ''));
    formData.append('visibility', String(payload?.visibility || 'community'));

    return requestFormData('/api/community/posts', formData, { method: 'POST' });
  },
  updatePost: (postId, payload) => request(`/api/community/posts/${postId}`, { method: 'PUT', body: payload }),
  deletePost: (postId) => request(`/api/community/posts/${postId}`, { method: 'DELETE' }),
  addComment: (postId, body) => request(`/api/community/posts/${postId}/comments`, { method: 'POST', body: { body } }),
  addReply: (postId, commentId, body) => request(`/api/community/posts/${postId}/comments/${commentId}/replies`, { method: 'POST', body: { body } }),
  updateComment: (postId, commentId, body) => request(`/api/community/posts/${postId}/comments/${commentId}`, { method: 'PUT', body: { body } }),
  deleteComment: (postId, commentId) => request(`/api/community/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
  savePost: (postId) => request(`/api/community/posts/${postId}/save`, { method: 'POST' }),
  unsavePost: (postId) => request(`/api/community/posts/${postId}/save`, { method: 'DELETE' }),
  likeComment: (postId, commentId) => request(`/api/community/posts/${postId}/comments/${commentId}/like`, { method: 'POST' }),
  unlikeComment: (postId, commentId) => request(`/api/community/posts/${postId}/comments/${commentId}/like`, { method: 'DELETE' }),
  likePost: (postId) => request(`/api/community/posts/${postId}/like`, { method: 'POST' }),
  unlikePost: (postId) => request(`/api/community/posts/${postId}/like`, { method: 'DELETE' }),
};

export const catalogApi = {
  listDoctors: () => request('/api/catalog/doctors'),
  getDoctorDetails: (doctorId) => request(`/api/catalog/doctors/${doctorId}`),
  listDoctorReviews: (doctorId) => request(`/api/catalog/doctors/${doctorId}/reviews`),
  upsertDoctorReview: (doctorId, payload) => request(`/api/catalog/doctors/${doctorId}/reviews`, { method: 'POST', body: payload }),
  deleteDoctorReview: (doctorId) => request(`/api/catalog/doctors/${doctorId}/reviews`, { method: 'DELETE' }),
  listArticles: () => request('/api/catalog/articles'),
  getRiskHistory: () => request('/api/catalog/risk-history'),
};

export const bookingApi = {
  createRequest: ({ doctorId, doctorName, specialty, location, nextSlot, available, preferredTime, message }) => request('/api/bookings/request', {
    method: 'POST',
    body: {
      doctorId,
      doctorName,
      specialty,
      location,
      nextSlot,
      available,
      preferredTime,
      message,
    },
  }),
  myRequests: () => request('/api/bookings/me'),
  respondToSuggestion: (requestId, action) => request(`/api/bookings/me/${requestId}/respond`, {
    method: 'PATCH',
    body: { action },
  }),
};

export const analysisApi = {
  analyze: () => request('/api/catalog/analysis/analyze', { method: 'GET' }),
  analyzeWithGradCAM: async (imageUri) => {
    const formData = new FormData();

    const fileName = imageUri?.split('/').pop() || 'lesion.jpg';
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: fileName,
      type: mime,
    });

    const res = await fetch(`${activeApiBaseUrl}/api/catalog/analysis/gradcam`, {
      method: 'POST',
      headers: {
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        // Do NOT set Content-Type; fetch will set it with boundary for FormData
      },
      body: formData,
    });

    if (!res.ok) {
      let payload = null;
      try {
        payload = await res.json();
      } catch (_error) {
        payload = null;
      }
      const error = new Error(payload?.message || `Grad-CAM analysis failed (${res.status})`);
      error.status = res.status;
      error.code = payload?.code;
      error.details = payload;
      throw error;
    }

    return res.json();
  },
};

export const chatApi = {
  listThreads: () => request('/api/chat/threads'),
  upsertThread: ({ doctorId, doctorName, specialty, avatarUrl = '' }) => request('/api/chat/threads', {
    method: 'POST',
    body: { doctorId, doctorName, specialty, avatarUrl },
  }),
  getMessages: (threadId) => request(`/api/chat/threads/${threadId}/messages`),
  markThreadRead: (threadId) => request(`/api/chat/threads/${threadId}/read`, { method: 'POST' }),
  sendMessage: (threadId, body) => request(`/api/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: { body },
  }),
};

