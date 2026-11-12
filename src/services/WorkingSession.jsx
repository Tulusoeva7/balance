import {createContext,useContext,useEffect,useState,useRef,useCallback} from 'react';
import {restorePostureStats} from '@/models/postureStats';
import {api} from './api';
import {useAppData} from './AppData';
const Context=createContext(null);
const cacheKey=(user,id)=>'balance:posture:'+user+':'+id;
const readCache=(user,id)=>{try{return id?JSON.parse(localStorage.getItem(cacheKey(user,id))||'{}'):{};}catch{return {};}};
const writeCache=(user,id,value)=>{if(!id)return;try{localStorage.setItem(cacheKey(user,id),JSON.stringify(value));}catch{}};

export function WorkingSessionProvider({children}){
 const {data,refresh}=useAppData();const [session,setSession]=useState(()=>data.sessions.find(s=>s.state!=='finished')||null);const ref=useRef(session);const [now,setNow]=useState(Date.now());const [error,setError]=useState('');const [busy,setBusy]=useState(false);const mutex=useRef(false);const stats=useRef(restorePostureStats(session?.posture,readCache(data.profile.id,session?.id)));
 const current=useCallback(()=>{const s=ref.current;if(!s)return null;const delta=Math.max(0,Math.floor((Date.now()-new Date(s.updated_at||s.started_at).getTime())/1000));return {...s,work_seconds:s.work_seconds+(s.state==='working'?delta:0),break_seconds:s.break_seconds+(s.state==='break'?delta:0),posture:stats.current};},[]);
 const commit=useCallback(async(state,extra={})=>{if(mutex.current)return null;mutex.current=true;setBusy(true);setError('');try{const s=current();if(!s)return null;const body={state,work_seconds:s.work_seconds,break_seconds:s.break_seconds,breaks_completed:s.breaks_completed,posture:stats.current,...extra};const value=await api(`/sessions/${s.id}`,{method:'PATCH',body});ref.current=value;setSession(value);if(state==='finished'){try{localStorage.removeItem(cacheKey(data.profile.id,s.id));}catch{}await refresh();}return value;}catch(e){setError(e.message);return null;}finally{mutex.current=false;setBusy(false);}},[current,refresh,data.profile.id]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!session||session.state==='finished')return;const timer=setInterval(()=>{commit(ref.current.state);},30000);return()=>clearInterval(timer);},[session?.id,session?.state,commit]);
 const start=async(interval)=>{setBusy(true);setError('');try{const s=await api('/sessions',{method:'POST',body:{interval_minutes:interval}});stats.current=restorePostureStats(s.posture,readCache(data.profile.id,s.id));ref.current=s;setSession(s);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const snapshot=current();const remaining=snapshot?Math.max(0,snapshot.next_break_work_seconds-snapshot.work_seconds):0;
 const due=snapshot?.state==='working'&&remaining===0;
 const recordPosture=useCallback(result=>{stats.current={samples:(stats.current.samples||0)+1,good_samples:(stats.current.good_samples||0)+(result.overall==='ok'?1:0),alerts:stats.current.alerts||0};writeCache(data.profile.id,ref.current?.id,stats.current);},[data.profile.id]);
 const recordAlert=useCallback(()=>{stats.current={...stats.current,alerts:(stats.current.alerts||0)+1};writeCache(data.profile.id,ref.current?.id,stats.current);if(ref.current?.state==='working')commit('working');},[commit,data.profile.id]);
 return <Context.Provider value={{session:snapshot,now,remaining,due,error,busy,start,commit,recordPosture,recordAlert}}>{children}</Context.Provider>;
}
export const useWorkingSession=()=>useContext(Context);
