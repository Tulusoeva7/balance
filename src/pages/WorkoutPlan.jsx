import {Link} from 'react-router-dom';
import {useAppData} from '@/services/AppData';
import {Page,Notice} from '@/components/AppUI';
import {PersonalPlan} from '@/components/PlanView';
import {localDate} from '@/services/api';
export default function WorkoutPlan(){
 const {data}=useAppData();const today=localDate();const ids=new Set(data.plan.exercises.map(e=>e.id));const done=data.logs.filter(l=>l.date===today&&ids.has(l.exercise_id)).length;
 const totalMinutes=Math.ceil(data.plan.exercises.reduce((sum,item)=>sum+(item.duration_seconds||0),0)/60);
 const status=data.plan.exercises.length?`Сегодня: ${done} из ${data.plan.exercises.length} выполнено · около ${totalMinutes} мин.`:'Сегодня упражнения не подобраны — ниже указана причина и следующий шаг.';
 return <Page title="Мой план" description="Здесь собраны действия на сегодня и рекомендации для вашего рабочего дня." aside={<Link to="/Onboarding?edit=1" className="app-button-secondary">Изменить ответы</Link>}>
  <div className="flex flex-wrap justify-between items-center gap-3"><p className="text-slate-700 font-medium">{status}</p><Link className="inline-flex min-h-11 items-center text-violet-700 font-semibold" to="/ExerciseLibrary">Библиотека упражнений →</Link></div>
  {data.plan.needs_update&&<Notice>Уточните ответы, чтобы возобновить персональный подбор.</Notice>}
  <PersonalPlan/>
 </Page>;
}
