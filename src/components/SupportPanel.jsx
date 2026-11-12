import {useEffect,useState} from 'react';
import {api} from '@/services/api';
import {Button,Notice} from '@/components/AppUI';
const TOPICS=[
 ['plan','План и упражнения'],
 ['diary','Дневник и прогресс'],
 ['timer','Таймер и напоминания'],
 ['account','Вход и профиль'],
 ['technical','Что-то не работает'],
 ['idea','Предложение по приложению'],
 ['other','Другое'],
];
export default function SupportPanel(){
 const [rows,setRows]=useState([]),[topic,setTopic]=useState(''),[customSubject,setCustomSubject]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 useEffect(()=>{let live=true;api('/support').then(value=>{if(live)setRows(value);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[]);
 const subject=topic==='other'?customSubject.trim():TOPICS.find(([value])=>value===topic)?.[1]||'';
 const send=async()=>{setBusy(true);setError('');try{const value=await api('/support',{method:'POST',body:{subject,message}});setRows(r=>[...value,...r]);setTopic('');setCustomSubject('');setMessage('');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="app-card space-y-4"><h2 className="text-xl font-bold">Написать в поддержку</h2><p className="text-slate-700">Выберите тему — так обращение будет проще понять. Если подходящей темы нет, выберите «Другое». Администратор получит только текст обращения; дневник и видео не прикладываются.</p><label className="app-label block">Тема обращения<select className="app-input mt-2" value={topic} onChange={e=>{setTopic(e.target.value);setCustomSubject('');}}><option value="">Выберите тему</option>{TOPICS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{topic==='other'&&<label className="app-label block">Напишите тему<input className="app-input mt-2" maxLength={150} value={customSubject} onChange={e=>setCustomSubject(e.target.value)} placeholder="Коротко опишите, о чём вопрос"/></label>}<label className="app-label block">Сообщение<textarea className="app-input mt-2 min-h-28" maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Расскажите, что произошло и что вы ожидали увидеть"/></label><Button disabled={busy||!subject||!message.trim()} onClick={send}>{busy?'Отправляем…':'Отправить обращение'}</Button>{error&&<Notice error>{error}</Notice>}{rows.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4 space-y-2"><h3 className="font-bold">{row.subject}</h3><p className="text-sm text-violet-800">{{open:'Открыто',in_progress:'В работе',closed:'Закрыто'}[row.status]} · {new Date(row.created_at).toLocaleDateString('ru-RU')}</p><p className="whitespace-pre-wrap break-words">{row.message}</p>{row.reply&&<div className="rounded-xl bg-violet-50 p-3"><p className="font-semibold">Ответ поддержки</p><p className="whitespace-pre-wrap break-words">{row.reply}</p></div>}</article>)}</section>;
}
