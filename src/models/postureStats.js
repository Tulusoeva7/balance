export function restorePostureStats(server={},cached={}){
 server=server||{};cached=cached||{};
 const count=value=>Number.isInteger(value)&&value>=0?value:0;
 const samples=Math.max(count(server.samples),count(cached.samples));
 const cachedGood=count(cached.good_samples)<=count(cached.samples)?count(cached.good_samples):0;
 return {samples,good_samples:Math.min(samples,Math.max(count(server.good_samples),cachedGood)),alerts:Math.max(count(server.alerts),count(cached.alerts))};
}
