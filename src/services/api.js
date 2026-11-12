import { supabase } from '@/lib/supabase';
const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
// VITE_API_URL may be empty (local proxy), '/api', or a backend origin.
// Normalize once so '/api' is never duplicated.
const API_ROOT = !RAW_API_BASE ? '/api' : RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : `${RAW_API_BASE}/api`;
/** @param {string} path @param {{method?:string,body?:any,signal?:AbortSignal}} options */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Войдите в приложение.');
  const response = await fetch(`${API_ROOT}${path}`, { method, signal: signal || AbortSignal.timeout(45000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  let result;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { result = await response.json(); } catch { result = null; }
  }
  if (!response.ok) {
    if (result?.error) throw new Error(result.error);
    throw new Error(response.status===401?'Войдите в приложение заново.':response.status===403?'Это действие недоступно вашему аккаунту.':'Не удалось загрузить или сохранить данные. Попробуйте ещё раз.');
  }
  if (!result) throw new Error('Не удалось получить данные. Попробуйте ещё раз.');
  return result;
}
export const localDate = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
export function visible(question, answers) {
  const c = question.when; if (!c) return true; const v = answers[c.key];
  if ('equals' in c) return v === c.equals;
  if ('not' in c) return v != null && v !== c.not;
  if ('contains' in c) return (v || []).includes(c.contains);
  if ('any' in c) return c.any.some(x => (v || []).includes(x));
  if ('count_greater' in c) return Array.isArray(v) && v.length > c.count_greater;
  return false;
}
