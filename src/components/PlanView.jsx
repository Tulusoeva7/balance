import DetailPanel from './DetailPanel';
import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Button,Notice} from './AppUI';
import {api,localDate} from '@/services/api';
import {useAppData} from '@/services/AppData';
import {BODY_ZONES} from '@/models/bodyZones';

const GROUPS=[['routine','Рабочий ритм','Когда работать и делать паузы'],['workplace','Рабочее место','Устройства и удобные опоры'],['break','Перерывы и движение','Как менять активность'],['tracking','Наблюдение','Что полезно отслеживать']];
export function Recommendation({item}){
 const paragraphs=(item.description||'').split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
 return <article className="recommendation-reading"><h3>{item.title}</h3>{paragraphs.length>0&&<div className="recommendation-copy">{paragraphs.map((text,index)=><p key={index}>{text}</p>)}</div>}<details className="recommendation-reason"><summary>Почему это в моём плане?</summary><p>{item.reason}</p></details></article>;
}
export function PlanGroups({recommendations}){
 const [category,setCategory]=useState(null);const safety=recommendations.filter(r=>r.kind==='safety');
 const chosen=GROUPS.find(([kind])=>kind===category);
 return <div className="space-y-3">{safety.length>0&&<details className="app-card bg-amber-50 border-amber-200"><summary>Обратите внимание · {safety.length} ограничения</summary><div className="space-y-4 mt-4">{safety.map(r=><Recommendation key={r.id} item={r}/>)}</div></details>}
 <div className="initial-plan-categories">{GROUPS.map(([kind,title,description],index)=>{
 const items=recommendations.filter(r=>(r.kind||'workplace')===kind);
 return <button key={kind} disabled={!items.length} className={'initial-plan-tile plan-category-button initial-plan-tile-'+index} onClick={()=>setCategory(kind)}><span className="initial-plan-number" aria-hidden="true">{index+1}</span><span><span className="block font-semibold">{title}</span><span className="block text-sm text-slate-600">{description}</span><span className="block text-sm mt-2 font-medium">{items.length?`Рекомендации: ${items.length} · Открыть →`:'Пока нет рекомендаций'}</span></span></button>;
 })}</div>
 <DetailPanel open={!!category} onClose={()=>setCategory(null)} title={chosen?.[1]||'Мой план'}><div className="recommendation-path">{recommendations.filter(r=>(r.kind||'workplace')===category).map((item,index)=><section className="recommendation-stop" key={item.id}><span className="initial-plan-number">{index+1}</span><Recommendation item={item}/></section>)}</div></DetailPanel></div>;
}
export function ExerciseItem({exercise,completed=false,log=null,onComplete,disabled=false}){
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [savedLog,setSavedLog]=useState(log);
 useEffect(()=>{setSavedLog(log);},[log]);
 const complete=async()=>{setBusy(true);setError('');try{const row=await api('/exercises/'+exercise.id+'/complete',{method:'POST',body:{date:localDate()}});setSavedLog(row);await onComplete?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const feedback=async feeling=>{if(!savedLog?.id)return;setBusy(true);setError('');try{const row=await api('/exercise-logs/'+savedLog.id,{method:'PATCH',body:{feeling}});setSavedLog(row);await onComplete?.();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const mins=Math.max(1,Math.ceil(exercise.duration_seconds/60));const done=completed||!!savedLog;
 const areas=(exercise.target_zones||[exercise.body_zone]).map(id=>BODY_ZONES.find(z=>z.id===id)?.label).filter(Boolean).join(', ');
 return <article className="app-card exercise-card space-y-3"><h3 className="font-bold text-xl">{exercise.title}</h3><div className="flex flex-wrap gap-2 text-sm font-semibold"><span className="rounded-lg bg-violet-100 px-3 py-2 text-violet-900">Для области: {areas}</span><span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-800">{mins} мин.</span><span className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{exercise.difficulty==='easy'?'Лёгкое упражнение':exercise.difficulty==='medium'?'Средняя сложность':'Сложность из каталога'}</span></div><p className="text-slate-800 leading-relaxed">{exercise.description}</p>{exercise.reason&&<p className="text-sm font-medium text-violet-700">Подобрано по вашим ответам</p>}
  {done&&<p className="text-sm font-medium text-emerald-700">✓ Выполнено сегодня</p>}
  {disabled&&!done&&<p className="text-sm text-amber-800">Упражнение сейчас не доступно для выполнения по вашим ответам. Инструкция доступна для просмотра.</p>}
  <Button secondary={open||done||disabled} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Свернуть':done?'Инструкция и обратная связь':disabled?'Посмотреть инструкцию':'Начать'}</Button>
  <DetailPanel open={open} onClose={()=>setOpen(false)} title={exercise.title}><div className="space-y-4"><p className="text-slate-600">{exercise.description}</p><div className="exercise-instructions"><h4 className="font-semibold">Как выполнять</h4><ol className="list-decimal ml-5 space-y-2">{(exercise.instructions||'').split('\n').filter(Boolean).map((step,i)=><li key={i}>{step}</li>)}</ol>{exercise.repetitions&&<p className="text-sm">{exercise.repetitions}</p>}</div>
   <p className="exercise-caution"><strong>Важно</strong> Выполняйте в комфортном диапазоне. При необычном или усиливающемся дискомфорте остановитесь.</p>
   {exercise.limitations?.filter(text=>text.trim()).length>0&&<section className="exercise-caution"><h4 className="font-semibold">Ограничения упражнения</h4><ul className="list-disc ml-5 space-y-2">{exercise.limitations.filter(text=>text.trim()).map((text,index)=><li key={index}>{text}</li>)}</ul></section>}
   {exercise.reason&&<details><summary>Почему это в моём плане?</summary><p className="mt-2 text-sm text-slate-600">{exercise.reason}</p></details>}
   {(exercise.source_url||exercise.media_url)&&<details><summary>Источник и демонстрация</summary><div className="mt-2 flex flex-wrap gap-3">{exercise.media_url?.startsWith('https://')&&<a className="text-violet-700 underline" href={exercise.media_url} target="_blank" rel="noreferrer">Посмотреть демонстрацию</a>}{exercise.source_url?.startsWith('https://')&&<a className="text-violet-700 underline" href={exercise.source_url} target="_blank" rel="noreferrer">Источник упражнения</a>}</div></details>}
   {error&&<Notice error>{error}</Notice>}
   {!done&&<Button disabled={busy||disabled} onClick={complete}>{busy?'Сохраняем…':disabled?'Выполнение недоступно':'Отметить как выполненное'}</Button>}
   {done&&!savedLog?.feedback&&<div className="exercise-feedback space-y-3"><h4 className="font-semibold">Как вы себя чувствуете?</h4><div className="flex flex-wrap gap-2">{[['better','Комфортнее'],['same','Без изменений'],['worse','Менее комфортно']].map(([value,label])=><Button key={value} secondary disabled={busy||!savedLog?.id} onClick={()=>feedback(value)}>{label}</Button>)}</div>{busy&&<p role="status">Сохраняем…</p>}</div>}
   {savedLog?.feedback&&<Notice>✓ Обратная связь сохранена: {{better:'комфортнее',same:'без изменений',worse:'менее комфортно'}[savedLog.feedback]}.</Notice>}
  </div></DetailPanel>
 </article>;
}
export function PersonalPlan({compact=false}){
 const {data,refresh}=useAppData();if(!data)return null;const today=localDate();
 const exercises=compact?data.plan.exercises.slice(0,2):data.plan.exercises;
 const minutes=Math.ceil(exercises.reduce((sum,item)=>sum+(item.duration_seconds||0),0)/60);
 const completed=exercises.filter(ex=>data.logs.some(log=>log.exercise_id===ex.id&&log.date===today)).length;
 return <div className="space-y-5"><section className="rounded-3xl border-2 border-violet-300 bg-gradient-to-br from-white to-violet-50 p-4 sm:p-6 space-y-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-violet-800">Сегодня для вас</p><h2 className="text-2xl font-bold text-slate-900 mt-1">Упражнения на сегодня</h2><p className="mt-2 text-slate-700">Откройте карточку, выполните шаги в комфортном диапазоне и отметьте самочувствие.</p></div>{exercises.length>0&&<span className="rounded-full bg-violet-700 px-4 py-2 text-sm font-bold text-white">{completed}/{exercises.length} · ~{minutes} мин.</span>}</div>
  {(data.plan.goal_labels?.length>0||data.plan.focus_zones?.length>0)&&<div className="flex flex-wrap gap-2 text-sm">{data.plan.focus_zones?.length>0&&<span className="rounded-full bg-white px-3 py-2 text-slate-800 border border-violet-200"><strong>Области:</strong> {data.plan.focus_zones.join(', ')}</span>}{data.plan.goal_labels?.length>0&&<span className="rounded-full bg-white px-3 py-2 text-slate-800 border border-violet-200"><strong>Цель:</strong> {data.plan.goal_labels.join(' · ')}</span>}</div>}
  {data.plan.selection_note&&<Notice warning>{data.plan.selection_note}</Notice>}
  {exercises.length?<div className="grid md:grid-cols-2 gap-4">{exercises.map(ex=>{const log=data.logs.find(l=>l.exercise_id===ex.id&&l.date===today);return <ExerciseItem key={ex.id} exercise={ex} completed={!!log} log={log} onComplete={refresh}/>;})}</div>:<div className="rounded-2xl border border-violet-200 bg-white p-5 space-y-3"><h3 className="text-lg font-bold text-slate-900">Сегодня без автоматического упражнения</h3><p className="text-slate-700">Это не ошибка: Balance не подставляет движение для другой области только ради заполнения времени.</p><div className="flex flex-wrap gap-3"><Link className="app-button-secondary" to="/PainDiary">Проверить дневник</Link><Link className="app-button-secondary" to="/Onboarding?edit=1">Проверить ответы</Link></div></div>}
  <details className="rounded-2xl border border-violet-200 bg-white px-4 py-2"><summary>Как сформирован план?</summary><div className="pb-3 text-sm leading-relaxed text-slate-700 space-y-2"><p>Подбор учитывает цели, отмеченные области, ограничения, условия выполнения, доступное время и обратную связь после упражнений.</p><p>Подходящие варианты чередуются по дням. Если вариант один, он может повторяться. Свободное время не заполняется нерелевантными упражнениями.</p></div></details>
 </section>{!compact&&<section className="space-y-3"><h2 className="text-xl font-bold">Рекомендации для рабочего дня</h2><PlanGroups recommendations={data.plan.recommendations}/></section>}{compact&&<Link className="app-button-secondary inline-flex items-center" to="/WorkoutPlan">Весь план →</Link>}</div>;
}
export function InitialPlanPreview(){
 const {data}=useAppData();if(!data)return null;
 const plan=data.plan;
 return <div className="initial-plan-preview">
  <p className="text-slate-600">Всё готово. Начните с одного действия в разделе «Сегодня».</p>
  <div className="initial-plan-summary"><span><strong>{plan.exercises.length}</strong> упражнений</span><span><strong>{plan.interval_minutes}</strong> мин. до перерыва</span><span><strong>{plan.break_minutes}</strong> мин. на паузу</span></div>
  {plan.recommendations.some(r=>r.kind==='safety')&&<p className="exercise-caution"><strong>Есть ограничения.</strong> Проверьте их в подробностях плана перед выполнением упражнений.</p>}
  <div className="initial-plan-categories">{GROUPS.map(([kind,title,description],index)=><div className={'initial-plan-tile initial-plan-tile-'+index} key={kind}><span className="initial-plan-number" aria-hidden="true">{index+1}</span><div><h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-600">{description}</p></div></div>)}</div>
  <details className="initial-plan-details"><summary>Посмотреть рекомендации и упражнения</summary><div className="pt-4"><PersonalPlan/></div></details>
 </div>;
}
