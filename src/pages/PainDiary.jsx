import {Link,useNavigate} from 'react-router-dom';
import {useState,useEffect,useRef} from 'react';
import {useAppData} from '@/services/AppData';
import {api,localDate} from '@/services/api';
import useCurrentDate from '@/hooks/useCurrentDate';
import {Page,Button,Notice} from '@/components/AppUI';
import BodyMap,{painColor,painLabel} from '@/components/BodyMap';
import {BODY_ZONES} from '@/models/bodyZones';
import {mergeDiaryArea} from '@/models/diaryState';
const FEELS=['тянет','ноет','скованность','усталость','после долгой работы','другое'];
export default function PainDiary(){
 const {data,refresh}=useAppData();const navigate=useNavigate();const current=useCurrentDate();const today=localDate(new Date(current));
 const [date,setDate]=useState(today);const [savedZones,setSavedZones]=useState({});const [drafts,setDrafts]=useState({});
 const [change,setChange]=useState('first');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [active,setActive]=useState(null);
 const [phase,setPhase]=useState('select');const [removeConfirm,setRemoveConfirm]=useState(false);
 const lock=useRef(false);const loadedDate=useRef(null);const pendingChanges=useRef(false);
 const entry=data.diary.find(item=>item.date===date);
 const dirty=Object.entries(drafts).some(([id,value])=>(Number.isInteger(value?.intensity)||value?.safety||value?.feelings?.length)&&JSON.stringify(value)!==JSON.stringify(savedZones[id]))||note!==(entry?.note||'')||change!==(entry?.overall_change||'first');
 pendingChanges.current=dirty;
 const confirmLeave=()=>!pendingChanges.current||window.confirm('Есть несохранённые изменения дневника. Покинуть запись без сохранения?');
 useEffect(()=>{
  const unload=event=>{if(pendingChanges.current){event.preventDefault();event.returnValue='';}};
  const link=event=>{if(event.defaultPrevented||!(event.target instanceof Element))return;const target=event.target.closest('a[href]');if(target&&target.getAttribute('href')!==window.location.pathname&&pendingChanges.current&&!window.confirm('Есть несохранённые изменения дневника. Перейти без сохранения?')){event.preventDefault();event.stopPropagation();}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',link,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',link,true);};
 },[]);
 useEffect(()=>{
  if(loadedDate.current===date)return;
  loadedDate.current=date;const e=data.diary.find(e=>e.date===date);
  setSavedZones(e?.zones||{});setDrafts({...e?.zones,...(active?{[active]:e?.zones?.[active]||{intensity:null,safety:null,feelings:[]}}:{})});setChange(e?.overall_change||'first');setNote(e?.note||'');
  setPhase(active?'edit':'select');setMessage('');setError('');
 },[date,data.diary]);
 const select=z=>{if(busy)return;setDrafts(prev=>({...prev,[z.id]:prev[z.id]||{intensity:null,safety:null,feelings:[]}}));setActive(z.id);setPhase('edit');setError('');setMessage('');setRemoveConfirm(false);};
 const update=(key,value)=>{if(busy)return;setDrafts(prev=>({...prev,[active]:{...prev[active],[key]:value}}));setError('');};
 const save=async(remove=false,noDiscomfort=false)=>{
  if(lock.current)return;let zones;
  try{zones=noDiscomfort?{}:remove?Object.fromEntries(Object.entries(savedZones).filter(([id])=>id!==active)):mergeDiaryArea(savedZones,active,drafts[active]);}catch(e){setError(e.message);return;}
  lock.current=true;setBusy(true);setError('');
  try{
   const record=await api('/diary',{method:'PUT',body:{date,overall_change:change,zones,note}});
   setSavedZones(record.zones);
   setDrafts(prev=>remove?Object.fromEntries(Object.entries(prev).filter(([id])=>id!==active)):{...prev,...(active?{[active]:record.zones[active]}:{})});
   setPhase('saved');setMessage(remove?'Область убрана из записи.':'✓ Запись сохранена');setRemoveConfirm(false);
   refresh().catch(()=>{});
  }catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 };
 const zone=BODY_ZONES.find(z=>z.id===active);const detail=active?drafts[active]:null;const ids=Object.keys(savedZones);const hasPrevious=data.diary.some(entry=>entry.date<date);
 const openEntry=e=>{if(!confirmLeave())return;loadedDate.current=e.date;setDate(e.date);setSavedZones(e.zones||{});setDrafts(e.zones||{});setChange(e.overall_change);setNote(e.note||'');setActive(null);setPhase('select');setMessage('');setError('');};
 return <Page title={<span className="diary-title">Дневник боли<time dateTime={date}>{new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</time></span>} description="Выберите область и оцените интенсивность от 0 до 5.">
  {(detail?.intensity===5||Object.values(savedZones).some(d=>d.intensity===5))&&<section className="diary-guidance"><strong>Очень сильная боль · 5/5</strong><p>Обратитесь к врачу для индивидуальной оценки. При внезапной сильной боли или быстром ухудшении нужна срочная помощь. Не выполняйте движение, усиливающее боль.</p>{data.diary.length>1&&<Link className="app-button-secondary inline-flex mt-3" to="/Analytics">Подготовить PDF для специалиста →</Link>}</section>}
  {phase==='saved'||phase==='done'?<section className="app-card space-y-4"><Notice>{message||'Записи за выбранную дату сохранены.'}</Notice>{phase==='saved'?<div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>{setActive(null);setPhase('select');setMessage('');}}>+ Добавить ещё область</Button><Button secondary disabled={busy} onClick={()=>{if(confirmLeave())navigate('/Dashboard');}}>Готово</Button></div>:<Button secondary onClick={()=>setPhase('select')}>Добавить или изменить область</Button>}</section>:<div className={'diary-layout grid lg:grid-cols-2 gap-4 items-start '+(active?'is-editing':'')}>
   <section className="app-card diary-map"><span className="diary-step">01 · Карта тела</span><h2 className="text-lg font-semibold mb-3">Выберите область, где ощущается дискомфорт</h2><BodyMap selectedZones={[...new Set([...ids,...(active?[active]:[])])]} intensities={Object.fromEntries(Object.entries({...savedZones,...drafts}).filter(([,d])=>Number.isInteger(d.intensity)).map(([id,d])=>[id,d.intensity]))} showList={false} showIntensityLegend={false} onZoneClick={select}/><details className="mt-3"><summary>Выбрать область из списка</summary><div className="grid grid-cols-2 gap-2 mt-2">{BODY_ZONES.map(z=><Button secondary key={z.id} aria-pressed={active===z.id} disabled={busy} onClick={()=>select(z)}>{z.label}</Button>)}</div></details></section>
   <section className="app-card diary-editor space-y-4">{zone&&detail?<><div className="diary-editor-heading"><span className="diary-step">02 · Оценка области</span><h2 className="text-xl font-bold">{zone.label}</h2><label className="app-label">Дата записи<input className="app-input mt-2" aria-label="Дата записи" type="date" max={today} value={date} disabled={busy} onChange={e=>{if(e.target.value&&confirmLeave())setDate(e.target.value);}}/></label></div><fieldset><legend className="app-label mb-2">Интенсивность · 0 — нет боли, 5 — очень сильная</legend><div className="pain-scale">{[0,1,2,3,4,5].map(v=><button key={v} type="button" disabled={busy} aria-pressed={detail.intensity===v} aria-label={v+' — '+painLabel(v)} className={detail.intensity===v?'active':''} style={/** @type {import('react').CSSProperties} */({'--pain':painColor(v)})} onClick={()=>{update('intensity',v);if(v===0)update('safety','no');else if(detail.intensity===0)update('safety',null);}}>{v}</button>)}</div>{Number.isInteger(detail.intensity)&&<p className="text-sm text-slate-700 mt-2">{detail.intensity}/5 · {painLabel(detail.intensity)}</p>}</fieldset>
    {Number.isInteger(detail.intensity)&&detail.intensity>0&&<fieldset className="rounded-2xl border border-slate-200 bg-white p-4"><legend className="app-label px-1">Уточнение для безопасного подбора</legend><p className="text-sm text-slate-600 mb-3">Есть ли новая слабость, онемение, покалывание, недавняя травма или заметное усиление ощущений в покое?</p><div className="flex flex-wrap gap-2">{[['no','Нет'],['yes','Да'],['unsure','Не уверен(а)']].map(([value,label])=><button key={value} type="button" disabled={busy} aria-pressed={detail.safety===value} onClick={()=>update('safety',value)} className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold ${detail.safety===value?'border-violet-700 bg-violet-700 text-white':'border-slate-300 bg-white text-slate-800 hover:border-violet-400'}`}>{label}</button>)}</div>{detail.safety&&detail.safety!=='no'&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Для этой области автоматический подбор будет приостановлен. При новых или усиливающихся ощущениях обратитесь к специалисту.</p>}</fieldset>}
    {hasPrevious&&<fieldset><legend className="app-label mb-2">Как изменилось самочувствие по сравнению с прошлой записью? · необязательно</legend><div className="flex flex-wrap gap-2">{[['better','Комфортнее'],['same','Без изменений'],['worse','Менее комфортно']].map(([value,label])=><button key={value} type="button" disabled={busy} aria-pressed={change===value} onClick={()=>setChange(value)} className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold ${change===value?'border-violet-700 bg-violet-700 text-white':'border-slate-300 bg-white text-slate-800 hover:border-violet-400'}`}>{label}</button>)}</div></fieldset>}
    <details><summary>Ощущения и комментарий · необязательно</summary><div className="space-y-4 mt-3"><fieldset><legend className="app-label mb-2">Как ощущается? · необязательно</legend><div className="chip-row">{FEELS.map(f=><button key={f} disabled={busy} aria-pressed={(detail.feelings||[]).includes(f)} className={(detail.feelings||[]).includes(f)?'selected':''} onClick={()=>update('feelings',(detail.feelings||[]).includes(f)?detail.feelings.filter(x=>x!==f):[...(detail.feelings||[]),f])}>{f}</button>)}</div></fieldset><label className="app-label block">Комментарий к записи · необязательно<textarea className="app-input mt-2" disabled={busy} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label></div></details>
    {Number.isInteger(detail.intensity)&&detail.intensity>0&&!detail.safety&&<p className="text-sm text-amber-800">Ответьте на уточнение для безопасного подбора перед сохранением.</p>}{error&&<Notice error>{error}</Notice>}<Button disabled={busy} onClick={()=>save()}>{busy?'Сохраняем…':'Сохранить'}</Button>
    {savedZones[active]&&<details><summary>Убрать область из записи</summary><p className="text-sm mt-2">Остальные сохранённые области останутся.</p><Button secondary disabled={busy} onClick={()=>removeConfirm?save(true):setRemoveConfirm(true)}>{removeConfirm?'Подтвердить удаление области':'Убрать область'}</Button></details>}
   </>:<><h2 className="text-lg font-semibold">Начните с карты тела</h2><p className="text-slate-600">Здесь появится оценка выбранной области. При переключении введённые ответы сохраняются до ухода со страницы.</p>{!ids.length&&<Button secondary disabled={busy} onClick={()=>save(false,true)}>{busy?'Сохраняем…':'Сегодня без дискомфорта'}</Button>}{error&&<Notice error>{error}</Notice>}</>}</section>
  </div>}
  {ids.length>0&&<section className="app-card !py-3"><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">{date===today?'Сегодня':'За выбранную дату'} отмечено: {ids.length} {ids.length===1?'область':ids.length<5?'области':'областей'}</h2>{ids.map(id=><button key={id} className="pain-history" style={{borderColor:painColor(savedZones[id].intensity),backgroundColor:painColor(savedZones[id].intensity)+'18'}} disabled={busy} onClick={()=>select(BODY_ZONES.find(z=>z.id===id))}>{BODY_ZONES.find(z=>z.id===id)?.label} · {savedZones[id].intensity}/5</button>)}</div></section>}
  <details className="app-card"><summary>Посмотреть историю · {data.diary.length}</summary><div className="mt-4 space-y-3">{data.diary.length?data.diary.map(e=><article key={e.id} className="rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap justify-between items-center gap-2"><b>{new Date(e.date+'T12:00:00').toLocaleDateString('ru-RU')}</b><Button secondary disabled={busy} onClick={()=>openEntry(e)}>Открыть запись</Button></div><div className="flex flex-wrap gap-2 mt-2">{Object.entries(e.zones).map(([id,d])=><span className="pain-history" key={id}>{BODY_ZONES.find(z=>z.id===id)?.label}: {d.intensity}/5</span>)}</div>{!Object.keys(e.zones).length&&<p className="text-sm mt-2">Дискомфорт не отмечен</p>}{e.note&&<p className="text-sm mt-2 whitespace-pre-wrap">{e.note}</p>}</article>):<p>Пока нет данных.</p>}</div></details>
 </Page>;
}
