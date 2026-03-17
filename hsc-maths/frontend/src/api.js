const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API}${url}`, {
    ...options,
    headers,
  });
}

export default API;