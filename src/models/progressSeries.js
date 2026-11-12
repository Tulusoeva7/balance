export function dailySeries(entries,zone,from,to){
 const current=new Date(from+'T00:00:00Z');const end=new Date(to+'T00:00:00Z');
 if(!Number.isFinite(current.getTime())||!Number.isFinite(end.getTime())||current>end)return [];
 const byDate=new Map(entries.map(e=>[e.date,e.zones?.[zone]?.intensity]));const points=[];
 while(current<=end){const key=current.toISOString().slice(0,10);const value=byDate.get(key);points.push({date:key.slice(5).split('-').reverse().join('.'),value:Number.isInteger(value)?value:null});current.setUTCDate(current.getUTCDate()+1);}
 return points;
}
