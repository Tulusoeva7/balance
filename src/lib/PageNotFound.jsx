import { Link } from 'react-router-dom';
import AppStatus from '@/components/AppStatus';
export default function PageNotFound() {
  return <AppStatus title="Страница не найдена">
    <p>Проверьте адрес или вернитесь на главный экран.</p>
    <Link className="text-indigo-600 underline" to="/">На главный экран</Link>
  </AppStatus>;
}
