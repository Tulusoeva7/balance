import { useState } from 'react';
import { Heart, LogIn, UserPlus, Shield, Activity, BarChart3, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const features = [
  { icon: Activity, text: 'Библиотека упражнений по областям тела' },
  { icon: BarChart3, text: 'Динамика боли и активности' },
  { icon: CalendarDays, text: 'Персональный план упражнений на сегодня' },
  { icon: Shield, text: 'Дневник боли и безопасный самоконтроль' },
];

// Перевод типичных ошибок Supabase на русский
function translateError(message) {
  if (message.includes('Invalid login credentials')) return 'Неверный email или пароль';
  if (message.includes('already registered')) return 'Пользователь с таким email уже зарегистрирован';
  if (message.includes('Password should be')) return 'Пароль должен содержать не менее 8 символов';
  if (message.includes('Email not confirmed')) return 'Подтвердите email по ссылке из письма';
  if (message.includes('rate limit')) return 'Слишком много попыток, попробуйте позже';
  return 'Не удалось выполнить действие. Проверьте данные и попробуйте ещё раз.';
}

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) setError(translateError(error.message));
      else if (!data.session) {
        setAwaitingConfirmation(true);
        setInfo('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(translateError(error.message));
    }
    } catch { setError('Не удалось соединиться. Проверьте интернет и повторите.'); } finally { setLoading(false); }
  }

  const continueAfterConfirmation = async () => {
    setLoading(true); setError(''); setInfo('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Email ещё не подтверждён. Откройте письмо от Balance, нажмите ссылку подтверждения и вернитесь сюда.');
        } else throw error;
      }
    } catch (e) { setError(translateError(e.message)); }
    finally { setLoading(false); }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';

  if (awaitingConfirmation) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-cyan-50/20 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4 text-3xl">✉️</div>
        <h2 className="text-2xl font-bold text-slate-900">Подтвердите электронную почту</h2>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">Мы создали аккаунт и отправили письмо на <strong>{email}</strong>.</p>
        <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-left text-sm text-slate-700 space-y-2">
          <p><strong>1.</strong> Откройте письмо от Balance.</p>
          <p><strong>2.</strong> Нажмите ссылку «Подтвердить email».</p>
          <p><strong>3.</strong> Вернитесь сюда и нажмите кнопку ниже.</p>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
        {info && <p className="mt-4 text-sm text-emerald-600">{info}</p>}
        <button type="button" disabled={loading} onClick={continueAfterConfirmation} className="mt-5 w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold rounded-xl disabled:opacity-60">{loading ? 'Проверяем…' : 'Я подтвердила email — продолжить'}</button>
        <button type="button" disabled={loading} onClick={async()=>{setLoading(true);setError('');try{const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setInfo('Новое письмо отправлено. Проверьте также папку «Спам».');}catch(e){setError(translateError(e.message));}finally{setLoading(false);}}} className="mt-3 text-sm text-indigo-600 hover:underline">Отправить письмо ещё раз</button>
        <button type="button" onClick={()=>{setAwaitingConfirmation(false);setIsSignUp(false);setError('');setInfo('');}} className="block mx-auto mt-4 text-xs text-slate-500 hover:underline">Вернуться ко входу</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-cyan-50/20 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">

        {/* Слева: информация */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-2xl tracking-tight">Balance</h1>
              <p className="text-sm text-slate-400">Самоконтроль при работе за компьютером</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-slate-900 leading-tight">
              Ваш персональный помощник<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
                по самоконтролю за компьютером
              </span>
            </h2>
            <p className="mt-3 text-slate-500 text-sm leading-relaxed">
              Система самоконтроля при длительной работе за компьютером.
              Помогает вести дневник боли, планировать перерывы, выполнять подобранные упражнения и отслеживать изменения.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map(({ icon: FeatureIcon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FeatureIcon className="w-4 h-4 text-indigo-600" />
                </div>
                {text}
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-400 leading-relaxed">
            ⚠️ Система не является медицинским изделием и не заменяет консультацию врача.
          </p>
        </div>

        {/* Справа: форма входа / регистрации */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              {isSignUp ? <UserPlus className="w-8 h-8 text-white" /> : <LogIn className="w-8 h-8 text-white" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              {isSignUp ? 'Регистрация' : 'Вход в систему'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {isSignUp ? 'Создайте аккаунт, чтобы начать работу' : 'Войдите, чтобы начать работу с Balance'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <label className="app-label block">Имя<input className={inputClass} aria-label="Имя" autoComplete="name" placeholder="Имя" value={fullName}
                     onChange={(e) => setFullName(e.target.value)} required /></label>
            )}
            <label className="app-label block">Email<input className={inputClass} type="email" aria-label="Email" autoComplete="email" placeholder="Email" value={email}
                   onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="app-label block">Пароль<input className={inputClass} type="password" aria-label="Пароль" autoComplete={isSignUp?"new-password":"current-password"} placeholder="Пароль (от 8 символов)"
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   required minLength={8} /></label>

            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-cyan-600 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Подождите...' : isSignUp ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setInfo(''); }}
            className="w-full mt-4 text-sm text-indigo-600 hover:underline"
          >
            {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-indigo-600">
            <button disabled={loading||!email} onClick={async()=>{setLoading(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});if(error)throw error;setInfo('Если аккаунт существует, письмо для смены пароля отправлено.');setError('');}catch(e){setError(translateError(e.message));}finally{setLoading(false);}}}>Забыли пароль?</button>
            <button disabled={loading||!email} onClick={async()=>{setLoading(true);try{const {error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setInfo('Письмо подтверждения отправлено повторно.');setError('');}catch(e){setError(translateError(e.message));}finally{setLoading(false);}}}>Повторить письмо подтверждения</button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">
            ИРНИТУ, институт ИТиАД · АСУб-23-1
          </p>
        </div>
      </div>
    </div>
  );
}
