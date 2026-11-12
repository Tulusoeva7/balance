import DetailPanel from '@/components/DetailPanel';
import ArticleCheck from '@/components/ArticleCheck';
import {useState} from 'react';
import {useAppData} from '@/services/AppData';
import {Page,Notice,Button} from '@/components/AppUI';
export default function Articles(){
 const {data}=useAppData();const [search,setSearch]=useState('');const [open,setOpen]=useState(null);
 const selected=Object.entries(data.answers.body_map?.zones||{}).filter(([,z])=>z.discomfort).map(([id])=>id);
 const items=[...data.articles].sort((a,b)=>Number(b.target_zones.some(z=>selected.includes(z)))-Number(a.target_zones.some(z=>selected.includes(z)))).filter(a=>(a.title+' '+a.content).toLowerCase().includes(search.toLowerCase()));
 return <Page title="Полезное" description="Короткие материалы для работы и самоконтроля."><label className="app-label block">Поиск материала<input className="app-input mt-2" placeholder="Название или тема" value={search} onChange={e=>setSearch(e.target.value)}/></label>{!items.length&&<Notice>Материалы не найдены. Попробуйте другой запрос.</Notice>}<div className="article-catalog grid md:grid-cols-2 gap-4 items-start">{items.map(a=>{
 const is=open===a.id;const minutes=Math.max(1,Math.ceil(a.content.split(/\s+/).length/160));const preview=a.content.split(/(?<=[.!?])\s|\n/)[0];
 return <article key={a.id} className="app-card article-card space-y-3"><p className="text-sm text-violet-700">Профилактика · {minutes} мин. чтения{a.target_zones.some(z=>selected.includes(z))?' · Для вас':''}</p><h2 className="font-semibold text-lg">{a.title}</h2><p className="text-slate-600 line-clamp-2">{preview}</p><Button secondary aria-expanded={is} onClick={()=>setOpen(is?null:a.id)}>Читать →</Button><DetailPanel open={is} onClose={()=>setOpen(null)} title={a.title}><div className="article-reading space-y-4"><p className="whitespace-pre-wrap text-slate-700">{a.content}</p>{a.source_url?.startsWith('https://')&&<a className="inline-flex min-h-11 items-center text-violet-700 underline" href={a.source_url} target="_blank" rel="noreferrer">Источник материала ↗</a>}<ArticleCheck article={a}/></div></DetailPanel></article>;
 })}</div><details className="app-card"><summary>Как формируются рекомендации?</summary><p className="mt-3 text-sm text-slate-600">Balance использует ваши ответы, ограничения и базу профилактических материалов. Источник указан в каждом материале.</p></details></Page>;
}
