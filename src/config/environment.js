export function validateConnection(url, key) {
  if (!url || !key) return 'Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local и перезапустите сервер.';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    return 'VITE_SUPABASE_URL должен быть адресом проекта Supabase.';
  }
  return null;
}
