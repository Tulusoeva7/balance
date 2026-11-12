import {Link} from 'react-router-dom';
import {Timer as TimerIcon,BookHeart,Dumbbell} from 'lucide-react';
import {useWorkingSession} from '@/services/WorkingSession';
import {useAppData} from '@/services/AppData';
import {localDate} from '@/services/api';
import useCurrentDate from '@/hooks/useCurrentDate';
import {Page,Notice} from '@/components/AppUI';

export default function Dashboard(){
 const {data}=useAppData();const work=useWorkingSession();const current=useCurrentDate();const today=localDate(new Date(current));
 const check=data.diary.find(e=>e.date===today);const logs=data.logs.filter(l=>l.date===today);
 const sessions=data.sessions.filter(s=>localDate(new Date(s.started_at))===today);
 const active=work.session&&work.session.state!=='finished'?work.session:null;
 const breaks=sessions.reduce((n,s)=>n+(s.breaks_completed||0),0);
 const exerciseIds=new Set(data.plan.exercises.map(e=>e.id));const completed=logs.filter(l=>exerciseIds.has(l.exercise_id)).length;
 const planned=data.plan.exercises.length+2;const done=completed+(check?1:0)+(breaks?1:0);
 const next=data.plan.exercises.find(e=>!logs.some(l=>l.exercise_id===e.id));
 const safety=data.plan.recommendations.find(r=>r.kind==='safety');
 return <Page title={'Добрый день, '+(data.profile.full_name||'рады вас видеть')+'!'} aside={<time className="date-pill" dateTime={today}>{new Date(current).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</time>}>
  <section className="balance-hero"><div><p className="eyebrow">Сейчас</p><h2>{active?active.state==='break'?'Время перерыва':active.state==='paused'?'Работа на паузе':'Следующий перерыв через '+Math.ceil(work.remaining/60)+' мин.':'Начните с рабочего таймера'}</h2><p>{active?'Вернитесь к таймеру, чтобы продолжить или завершить работу.':'Balance напомнит о паузе через выбранный вами интервал.'}</p></div><Link className="hero-button" to="/Timer">{active?'Открыть таймер':'Начать работу'}</Link></section>
  <section className="app-card"><div className="section-head"><h2>План на сегодня</h2><span className="text-sm text-slate-600">{done} из {planned} выполнено</span></div><div className="grid md:grid-cols-3 gap-3"><Link className="action-card pink" to="/PainDiary"><BookHeart/><div><b>Дневник боли</b><span>{check?'✓ Запись сохранена':'Отметить самочувствие'}</span></div></Link><Link className="action-card violet" to="/WorkoutPlan"><Dumbbell/><div><b>Упражнения</b><span>{data.plan.exercises.length?`${completed} из ${data.plan.exercises.length} выполнено`:'Пока не подобраны — открыть причину'}</span></div></Link><Link className="action-card blue" to="/Timer"><TimerIcon/><div><b>Работа и перерывы</b><span>{breaks?'✓ Перерыв завершён':active?'Таймер запущен':'Запланировать паузу'}</span></div></Link></div></section>
  {safety&&<Notice warning><strong>{safety.title}</strong> <Link className="underline" to="/WorkoutPlan">Посмотреть ограничения</Link></Notice>}
  {data.plan.needs_update&&<Notice>Для подбора движений уточните ответы. <Link className="underline" to="/Onboarding?edit=1">Обновить настройку</Link></Notice>}
  {next&&<section className="app-card compact-feature"><div><p className="eyebrow">Следующее упражнение · {Math.max(1,Math.ceil(next.duration_seconds/60))} мин.</p><h2>{next.title}</h2><p className="line-clamp-2">{next.description}</p></div><Link className="app-button-secondary" to="/WorkoutPlan">Посмотреть</Link></section>}
  <Link className="inline-flex min-h-11 items-center font-semibold text-violet-700" to="/WorkoutPlan">Весь план →</Link>
 </Page>;
}
