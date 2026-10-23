import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
api.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401 && !e.config.url.includes('/auth/')) { localStorage.removeItem('token'); location.href = '/login'; }
  return Promise.reject(e);
});
export const errMsg = e => e.response?.data?.message || e.message;
export const inr = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const dstr = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const today = () => new Date().toISOString().slice(0, 10);
export const r4 = n => (isFinite(n) ? String(Math.round(n * 10000) / 10000) : '');
export const toast = (msg, type = 'ok') => window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } }));
export const download = async (path, name) => {
  try { const r = await api.get(path, { responseType: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = name; a.click(); }
  catch (e) { toast(errMsg(e), 'err'); }
};
