import { createContext, useState, useContext, useEffect } from 'react';
import { supabase, configurationError } from '@/lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [passwordRecovery,setPasswordRecovery]=useState(()=>window.location.hash.includes('type=recovery'));
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // 1. Следим за сессией Supabase (вход, выход, обновление токена)
  useEffect(() => {
    if (configurationError) {
      setAuthError({ type: 'configuration', message: configurationError });
      setIsLoadingAuth(false);
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      if (!active) return;
      setAuthError({ type: 'connection', message: 'Загрузка сессии заняла слишком много времени. Проверьте подключение и повторите.' });
      setIsLoadingAuth(false);
    }, 15000);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      clearTimeout(timeout);
      if (error) throw error;
      setAuthError(null);
      setSession(data.session);
      if (!data.session) setIsLoadingAuth(false);
    }).catch(() => {
      if (!active) return;
      clearTimeout(timeout);
      setAuthError({ type: 'connection', message: 'Не удалось загрузить сессию. Проверьте подключение и повторите.' });
      setIsLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (!newSession) {
        setProfile(null);
        setIsLoadingAuth(false);
      }
    });
    return () => { active = false; clearTimeout(timeout); sub.subscription.unsubscribe(); };
  }, []);

  // 2. Когда есть сессия, загружаем профиль (роль и имя) из таблицы profiles
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setIsLoadingAuth(true);
      try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).abortSignal(AbortSignal.timeout(15000)).single();
      if (error || !data) throw error || new Error('Profile missing');
      if (cancelled) return;
      if (data?.is_blocked) {
        await supabase.auth.signOut();
        return;
      }
      // Compatibility with accounts created by older Balance builds:
      // an existing initial survey is authoritative evidence that onboarding was completed.
      let resolvedProfile = data;
      if (!data.onboarding_completed) {
        const { data: initialSurvey, error: surveyError } = await supabase
          .from('surveys').select('id').eq('user_id', session.user.id).eq('survey_type', 'initial').limit(1).maybeSingle();
        if (!surveyError && initialSurvey) {
          const { data: repaired } = await supabase
            .from('profiles').update({ onboarding_completed: true }).eq('id', session.user.id).select('*').single();
          resolvedProfile = repaired || { ...data, onboarding_completed: true };
        }
      }
      setAuthError(null);
      setProfile(resolvedProfile);
      } catch {
        if (!cancelled) setAuthError({ type: 'profile', message: 'Не удалось загрузить профиль. Проверьте подключение или обратитесь к администратору.' });
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Перечитать профиль после изменений (например, после прохождения опроса)
  const refreshProfile = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (error) throw error;
    setProfile(data);
  };

  const isAuthenticated = !!session;

  // Без сессии показываем экран входа (App.jsx ждёт именно такую ошибку)
  const effectiveError = authError || (!isLoadingAuth && !isAuthenticated
    ? { type: 'auth_required', message: 'Требуется вход' }
    : null);

  // Объект пользователя в привычном для остального кода виде
  const user = session
    ? {
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'user',
        ...profile,
      }
    : null;

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      passwordRecovery,
      finishPasswordRecovery: () => setPasswordRecovery(false),
      profile,
      isAuthenticated,
      isAdmin: profile?.role === 'admin',
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: effectiveError,
      appPublicSettings: null,
      logout,
      refreshProfile,
      navigateToLogin: () => {},
      checkAppState: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
