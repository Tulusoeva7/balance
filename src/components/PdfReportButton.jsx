import {useRef,useState} from 'react';
import html2canvas from 'html2canvas';
import {jsPDF} from 'jspdf';
import {useAppData} from '@/services/AppData';
import {BODY_ZONES} from '@/models/bodyZones';
import {painColor} from './BodyMap';
import {Button,Notice} from './AppUI';
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('ru-RU');
const feeling={better:'Комфортнее',same:'Без изменений',worse:'Менее комфортно'};
const groups=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));
const zoneLabel=id=>BODY_ZONES.find(z=>z.id===id)?.label||id;
const splitNote=text=>{
 const chunks=[];let rest=text||'';
 while(rest){const limit=chunks.length?1500:450;let end=Math.min(limit,rest.length);const word=rest.lastIndexOf(' ',end);if(end<rest.length&&word>end/2)end=word+1;const lines=[...rest.slice(0,end).matchAll(/\n/g)];const maxLines=chunks.length?25:10;if(lines.length>maxLines)end=lines[maxLines-1].index+1;chunks.push(rest.slice(0,end));rest=rest.slice(end);}
 return chunks.length?chunks:[''];
};
function ReportPage({number,total,title,subtitle,name,from,to,children}){
 return <section className="pdf-sheet" data-pdf-page><header className="pdf-header"><span className="pdf-brand">Balance / самоконтроль</span><span>{dateLabel(from)} - {dateLabel(to)}</span></header><div className="pdf-section-heading"><span className="pdf-section-number">{number}</span><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="pdf-person">{name}</div><div className="pdf-body">{children}</div><footer className="pdf-footer"><span>Пользовательские записи. Не медицинское заключение.</span><span>{number} / {total}</span></footer></section>;
}
export default function PdfReportButton({entries=[],logs=[],sessions=[],from,to}){
 const {data}=useAppData();const reportRef=useRef(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const ordered=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
 const stats=BODY_ZONES.map(zone=>{const values=ordered.filter(e=>Number.isInteger(e.zones?.[zone.id]?.intensity)).map(e=>({date:e.date,value:e.zones[zone.id].intensity}));return {...zone,count:values.length,first:values[0],last:values.at(-1),average:values.length?values.reduce((n,d)=>n+d.value,0)/values.length:null,max:values.length?Math.max(...values.map(d=>d.value)):null};});
 const breaks=sessions.reduce((n,s)=>n+(s.breaks_completed||0),0);
 const minutes=Math.floor(sessions.reduce((n,s)=>n+(s.work_seconds||0),0)/60);
 const samples=sessions.reduce((n,s)=>n+(s.posture?.samples||0),0),good=sessions.reduce((n,s)=>n+(s.posture?.good_samples||0),0),alerts=sessions.reduce((n,s)=>n+(s.posture?.alerts||0),0);
 const evaluated=stats.filter(z=>z.count),max=Math.max(...evaluated.map(z=>z.max));
 const pages=[];
 pages.push({title:'Отчёт о самочувствии и активности',subtitle:'Сводка за выбранный период',body:<>
  <div className="pdf-highlight"><strong>О данных отчёта</strong><p>Отчёт сформирован автоматически на основании данных самонаблюдения пользователя. Он не является медицинским заключением.</p></div>
  <div className="pdf-metrics">{[['Записей дневника',entries.length],['Областей с оценкой',evaluated.length],['Упражнений',logs.length],['Предупреждений камеры',alerts]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
  <h2>01 / Самочувствие</h2><p>{entries.length?'Записи расположены по датам. Шкала интенсивности: 0 - нет боли, 5 - очень сильная.':'В выбранном периоде записей дневника нет.'}</p>
  {evaluated.length>0&&<div className="pdf-highlight"><strong>Наибольшая отмеченная интенсивность: {max} из 5</strong><p>{evaluated.filter(z=>z.max===max).map(z=>z.label).join(', ')}. Это пользовательская оценка, а не диагноз.</p></div>}
  <h2>02 / Работа и перерывы</h2><div className="pdf-facts"><span><b>{minutes} мин.</b> учтённой работы</span><span><b>{breaks}</b> завершённых перерывов</span><span><b>{sessions.length}</b> рабочих сессий</span></div>
  <h2>03 / Контроль положения тела</h2><p>{samples?good+' из '+samples+' наблюдений без сигнала о смене положения. Предупреждений: '+alerts+'.':'Наблюдений камеры за период нет. Это не означает отсутствие отклонений положения.'}</p>
  <div className="pdf-note"><strong>Как читать отчёт</strong><p>Далее: оценки по областям, записи с ощущениями и комментариями, выполненные упражнения, работа и предупреждения камеры. Пропущенные оценки не считаются нулевыми. Причины боли и медицинские выводы приложение не определяет.</p></div>
 </>});
 pages.push({title:'Самочувствие по областям',subtitle:'Сравнение записей без автоматических выводов',body:<>
 <table className="pdf-table"><thead><tr><th>Область</th><th>Записей</th><th>Первая</th><th>Последняя</th><th>Средняя</th><th>Максимум</th></tr></thead><tbody>{stats.map(z=><tr key={z.id}><td>{z.label}</td><td>{z.count}</td><td>{z.first?.value??'-'}</td><td>{z.last?.value??'-'}</td><td>{z.average===null?'-':z.average.toFixed(1)}</td><td><span style={{color:z.max>=4?'#9f1239':'#334155',fontWeight:700}}>{z.max??'-'}</span></td></tr>)}</tbody></table>
 <p className="pdf-small">Все оценки указаны по шкале 0-5. Первая и последняя - по дате записи в выбранном периоде. Средняя рассчитана только по заполненным оценкам.</p><div className="pdf-scale">{[0,1,2,3,4,5].map(n=><span key={n} style={{borderBottom:'6px solid '+painColor(n)}}>{n}/5</span>)}</div>
 </>});
 for(const entry of ordered){
 const notes=splitNote(entry.note);
 notes.forEach((note,index)=>pages.push({title:'Дневник боли / '+dateLabel(entry.date),subtitle:index?'Продолжение комментария':'Сохранённые оценки и ощущения',body:<>
 {index===0&&<div className="pdf-diary-zones">{Object.entries(entry.zones||{}).length?Object.entries(entry.zones).map(([id,detail])=><div key={id} style={{borderLeft:'5px solid '+painColor(detail.intensity)}}><strong>{zoneLabel(id)} <span>{detail.intensity}/5</span></strong><p>{detail.feelings?.length?detail.feelings.join(', '):'Ощущения не уточнены'}</p></div>):<p>Дискомфорт не отмечен.</p>}</div>}
 {note&&<div className="pdf-note"><strong>{index?'Комментарий / продолжение':'Комментарий пользователя'}</strong><p className="pdf-user-note">{note}</p></div>}
 {index===0&&<p className="pdf-small">Запись отражает самооценку пользователя за указанную дату.</p>}
 </>}));
 }
 const logPages=groups([...logs].sort((a,b)=>a.date.localeCompare(b.date)),10);if(!logPages.length)logPages.push([]);
 if(logs.length)logPages.forEach(batch=>pages.push({title:'Упражнения и обратная связь',subtitle:'Фактически отмеченные выполнения',body:<>{batch.length?<table className="pdf-table"><thead><tr><th>Дата</th><th>Упражнение</th><th>Время</th><th>После выполнения</th></tr></thead><tbody>{batch.map(log=><tr key={log.id}><td>{dateLabel(log.date)}</td><td>{data.exercises.find(e=>e.id===log.exercise_id)?.title||'Упражнение из каталога'}</td><td>{Math.round((log.duration_seconds||0)/60)} мин.</td><td>{feeling[log.feedback]||'Не указано'}</td></tr>)}</tbody></table>:<p>В выбранном периоде выполнения упражнений не отмечены.</p>}<p className="pdf-small">Отметка выполнения и обратная связь вводятся пользователем. Они не подтверждают лечебный эффект.</p></>}));
 const sessionPages=groups([...sessions].sort((a,b)=>a.started_at.localeCompare(b.started_at)),8);if(!sessionPages.length)sessionPages.push([]);
 sessionPages.forEach(batch=>pages.push({title:'Работа, перерывы и камера',subtitle:'Сохранённые счётчики рабочих сессий',body:<>
 <div className="pdf-metrics">{[['Работа, мин.',minutes],['Перерывы',breaks],['Наблюдения камеры',samples],['Предупреждения',alerts]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
 {batch.length?<table className="pdf-table"><thead><tr><th>Начало</th><th>Работа, мин.</th><th>Перерывы</th><th>Наблюдения</th><th>Предупреждения</th></tr></thead><tbody>{batch.map(session=><tr key={session.id}><td>{new Date(session.started_at).toLocaleString('ru-RU')}</td><td>{Math.floor((session.work_seconds||0)/60)}</td><td>{session.breaks_completed||0}</td><td>{session.posture?.samples||0}</td><td>{session.posture?.alerts||0}</td></tr>)}</tbody></table>:<p>В выбранном периоде рабочих сессий нет.</p>}
 <div className="pdf-note"><strong>Что считается предупреждением</strong><p>Одно срабатывание напоминания о смене положения, а не каждый кадр камеры. Наблюдение - отдельная оценка положения алгоритмом. Видео, кадры и координаты тела в отчёт не включаются. Данные камеры служат ориентиром самоконтроля.</p></div>
 <p className="pdf-small">Сессии включены по дате начала. Длительность незавершённой сессии отражает последнее сохранение; статистика камеры зависит от её использования.</p>
 </>}));
 const download=async()=>{if(!reportRef.current)return;setBusy(true);setError('');try{
 await document.fonts.ready;
 const sheets=[...reportRef.current.querySelectorAll('[data-pdf-page]')].map(sheet=>sheet.cloneNode(true));
 const rendered=[];
 for(const sheet of sheets){
 const clone=/** @type {HTMLElement} */(sheet);
 Object.assign(clone.style,{position:'absolute',left:'-10000px',top:window.scrollY+'px',width:'794px',height:'auto',minHeight:'0',fontFamily:'Arial, sans-serif',color:'#172033',paddingBottom:'20px'});
 clone.querySelector('.pdf-footer')?.remove();
 const body=/** @type {HTMLElement} */(clone.querySelector('.pdf-body'));
 Object.assign(body.style,{flex:'none',overflow:'visible',minHeight:'0'});
 document.body.appendChild(clone);
 try{
 // Freeze each section before capture. Breaks must fall between text lines,
 // and preserve complete table rows/cards whenever they fit on one page.
 const origin=clone.getBoundingClientRect().top;
 const protectedRanges=[];
 const walker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  if(!walker.currentNode.textContent.trim())continue;
  const range=document.createRange();range.selectNodeContents(walker.currentNode);
  for(const rect of Array.from(range.getClientRects()))protectedRanges.push([rect.top-origin-2,rect.bottom-origin+2]);
 }
 for(const element of Array.from(clone.querySelectorAll('tr,.pdf-metrics,.pdf-diary-zones>div,.pdf-section-heading,.pdf-note,.pdf-highlight'))){
  const rect=element.getBoundingClientRect();if(rect.height<900)protectedRanges.push([rect.top-origin-2,rect.bottom-origin+2]);
 }
 const canvas=await html2canvas(clone,{scale:2,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0,windowWidth:window.innerWidth,windowHeight:window.innerHeight});
 const scale=canvas.width/794;const naturalHeight=canvas.height/scale;const capacity=naturalHeight<=1150?Math.max(1000,naturalHeight):1000;let start=0;
 while(start<canvas.height/scale){
  const limit=Math.min(start+capacity,canvas.height/scale);let end=limit;
  let changed=true;
  while(changed){changed=false;for(const [top,bottom] of protectedRanges){if(top<end&&bottom>end&&top>start+1){end=top;changed=true;}}}
  if(end<=start+1)throw new Error('Не удалось перенести строку отчёта.');
  const page=document.createElement('canvas');page.width=1588;page.height=2246;
  const ctx=page.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,page.width,page.height);
  const y1=Math.round(start*scale),y2=Math.round(end*scale);
  const fit=Math.min(1,1000/capacity);const width=page.width*fit;
  ctx.drawImage(canvas,0,y1,canvas.width,y2-y1,(page.width-width)/2,60,width,(y2-y1)*width/canvas.width);
  rendered.push(page);start=end;
 }
 }finally{clone.remove();}
 }
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 for(let index=0;index<rendered.length;index++){
  const page=rendered[index];const ctx=page.getContext('2d');
  ctx.fillStyle='#64748b';ctx.font='24px Arial';ctx.fillText('Balance · Самонаблюдение. Не медицинское заключение.',76,2180);
  ctx.textAlign='right';ctx.fillText(`${index+1} / ${rendered.length}`,1512,2180);
  if(index)pdf.addPage();pdf.addImage(page.toDataURL('image/png'),'PNG',0,0,210,297,'report-page-'+index,'FAST');
 }
 pdf.setProperties({title:'Balance: самочувствие и активность',subject:'Пользовательские записи самоконтроля',creator:'Balance'});pdf.save('Balance_report_'+from+'_'+to+'.pdf');
 }catch{setError('Не удалось скачать PDF. Повторите попытку. Если ошибка сохраняется, обратитесь в поддержку.');}finally{setBusy(false);}};
 return <><div className="no-print space-y-2"><Button secondary disabled={busy} onClick={download}>{busy?'Формируем PDF…':'Скачать PDF-отчёт'}</Button>{error&&<Notice error>{error}</Notice>}</div><div aria-hidden="true" ref={reportRef} className="pdf-export-root">{pages.map((page,index)=><ReportPage key={index} number={index+1} total={pages.length} title={page.title} subtitle={page.subtitle} name={data.profile.full_name||data.profile.email} from={from} to={to}>{page.body}</ReportPage>)}</div></>;
}
