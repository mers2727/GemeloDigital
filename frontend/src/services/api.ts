const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || res.statusText);
  }
  return res.json();
}

// Auth
export const signup = (email: string, password: string, full_name: string) =>
  request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name }),
  });

export const login = (email: string, password: string) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getMe = () => request('/me');

// Company
export const createCompany = (name: string, sector: string, country: string) =>
  request('/company', {
    method: 'POST',
    body: JSON.stringify({ name, sector, country }),
  });

export const getCompany = () => request('/company');

// Datasets
export const uploadDataset = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('/datasets/upload', { method: 'POST', body: formData });
};

export const listDatasets = () => request('/datasets');

export const getDataset = (id: string) => request(`/datasets/${id}`);

// Profiles
export const createProfile = (data: {
  name: string;
  segment_column: string;
  price_column: string;
  demand_column: string;
  date_column?: string;
  description?: string;
}) =>
  request('/profiles', { method: 'POST', body: JSON.stringify(data) });

export const listProfiles = () => request('/profiles');

// Twin
export const buildTwin = (dataset_id: string, profile_id: string, method: string, price_change: number) =>
  request('/twin/build', {
    method: 'POST',
    body: JSON.stringify({ dataset_id, profile_id, method, price_change }),
  });

export const getLatestTwin = () => request('/twin/latest');

export const listAnalyses = () => request('/twin/analyses');

export const getAnalysis = (id: string) => request(`/twin/analysis/${id}`);

// Scenarios
export const createScenario = (data: {
  name: string;
  analysis_id: string;
  actions: { segment: string; price_change: number }[];
}) =>
  request('/scenarios', { method: 'POST', body: JSON.stringify(data) });

export const listScenarios = () => request('/scenarios');

export const getScenario = (id: string) => request(`/scenarios/${id}`);
