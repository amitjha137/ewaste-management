// Simple API utility for frontend (mobile/LAN friendly)

// Import authentication helper
import { authFetch } from './auth.js';


// ==========================================
// BACKEND CONFIGURATION
// ==========================================

const BACKEND_ORIGIN =
  typeof window !== 'undefined' &&
  window.BACKEND_URL
    ? window.BACKEND_URL.replace(/\/$/, '')
    : (
        typeof window !== 'undefined' &&
        window.location &&
        window.location.origin &&
        window.location.origin !== 'null'
          ? window.location.origin
          : 'http://localhost:5000'
      );

const API_BASE = `${BACKEND_ORIGIN}/api`;


// Mock mode removed
function withMock(url) {
  return url;
}


// ==========================================
// BIN API
// ==========================================

export async function getBins() {
  const res = await fetch(
    withMock(`${API_BASE}/bins`)
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch bins: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// STATS API
// ==========================================

export async function getStats() {
  const res = await fetch(
    withMock(`${API_BASE}/stats`)
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// EVENTS API - ALL EVENTS
// Used by existing admin/collector dashboard
// ==========================================

export async function getEvents() {
  const res = await fetch(
    withMock(`${API_BASE}/events`)
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// EVENTS API - LOGGED-IN USER ONLY
// ==========================================

export async function getMyEvents() {
  const res = await authFetch(
    `${API_BASE}/events/mine`
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    throw new Error(
      `Failed to fetch personal events: ${res.status} ${text}`
    );
  }

  return res.json();
}


// ==========================================
// CREATE EVENT
// Sends login token when available
// ==========================================

export async function postEvent(eventData) {
  const res = await authFetch(
    withMock(`${API_BASE}/events`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    throw new Error(
      `Failed to post event: ${res.status} ${text}`
    );
  }

  return res.json().catch(() => ({}));
}


// ==========================================
// USERS API
// ==========================================

export async function getUsers() {
  const res = await fetch(
    withMock(`${API_BASE}/users`)
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch users: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// DEVICE MANAGEMENT API (ADMIN)
// ==========================================

export async function getDevices(adminToken) {
  const res = await fetch(
    `${API_BASE}/device-mgmt/devices`,
    {
      headers: {
        'x-admin-token': adminToken
      }
    }
  );

  return res.json();
}


export async function getDeviceTokens(adminToken) {
  const res = await fetch(
    `${API_BASE}/device-mgmt/tokens`,
    {
      headers: {
        'x-admin-token': adminToken
      }
    }
  );

  return res.json();
}


export async function addDeviceToken(adminToken, token) {
  const res = await fetch(
    `${API_BASE}/device-mgmt/tokens`,
    {
      method: 'POST',
      headers: {
        'x-admin-token': adminToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    }
  );

  return res.json();
}


export async function removeDeviceToken(adminToken, token) {
  const res = await fetch(
    `${API_BASE}/device-mgmt/tokens/${encodeURIComponent(token)}`,
    {
      method: 'DELETE',
      headers: {
        'x-admin-token': adminToken
      }
    }
  );

  return res.json();
}


// ==========================================
// BIN MANAGEMENT
// ==========================================

export async function createBin(data) {
  const res = await fetch(
    withMock(`${API_BASE}/bins`),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!res.ok) {
    throw new Error(`Create bin failed: ${res.status}`);
  }

  return res.json();
}


export async function updateBin(id, data) {
  const res = await fetch(
    withMock(`${API_BASE}/bins/${id}`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!res.ok) {
    throw new Error(`Update bin failed: ${res.status}`);
  }

  return res.json();
}


export async function deleteBin(id) {
  const res = await fetch(
    withMock(`${API_BASE}/bins/${id}`),
    {
      method: 'DELETE'
    }
  );

  if (!res.ok) {
    throw new Error(`Delete bin failed: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// USER MANAGEMENT
// ==========================================

export async function updateUser(id, data) {
  const res = await fetch(
    withMock(`${API_BASE}/users/${id}`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!res.ok) {
    throw new Error(`Update user failed: ${res.status}`);
  }

  return res.json();
}


export async function deleteUser(id) {
  const res = await fetch(
    withMock(`${API_BASE}/users/${id}`),
    {
      method: 'DELETE'
    }
  );

  if (!res.ok) {
    throw new Error(`Delete user failed: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// STATS MANAGEMENT
// ==========================================

export async function updateStats(data) {
  const res = await fetch(
    withMock(`${API_BASE}/stats`),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!res.ok) {
    throw new Error(`Update stats failed: ${res.status}`);
  }

  return res.json();
}


// ==========================================
// MOCK API COMPATIBILITY
// ==========================================

export function setMockEnabled(on) {
  // Mock mode removed
}

export function getMockEnabled() {
  return false;
}