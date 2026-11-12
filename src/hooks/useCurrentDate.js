import { useEffect, useState } from 'react';

// Текущая дата в часовом поясе устройства пользователя.
export default function useCurrentDate() {
  const [date, setDate] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setDate(now);
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(update, midnight.getTime() - now.getTime() + 50);
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return date;
}
