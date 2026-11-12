import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BODY_ZONES } from '@/models/bodyZones';
import { api, localDate } from './api';
const Context = createContext(null);
export function AppDataProvider({ children }) {
 const [data,setData]=useState(null); const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try { const value=await api('/bootstrap?plan_date='+localDate());for (const z of value.body_zones||[]) {const match=BODY_ZONES.find(x=>x.id===z.id);if(match)match.label=z.label;}setData(value);setError('');return value;}catch(e){setError(e.message);throw e;}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh().catch(()=>{});let day=localDate();const updateDay=()=>{const next=localDate();if(next!==day){day=next;refresh().catch(()=>{});}};const timer=setInterval(updateDay,60000);window.addEventListener('focus',updateDay);return()=>{clearInterval(timer);window.removeEventListener('focus',updateDay);};},[refresh]);
 return <Context.Provider value={{data,error,loading,refresh}}>{children}</Context.Provider>;
}
export const useAppData=()=>useContext(Context);
