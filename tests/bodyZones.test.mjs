import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeDiaryArea} from '../src/models/diaryState.js';
import {dailySeries} from '../src/models/progressSeries.js';
import {normalizeOnboardingAnswers} from '../src/models/onboardingAnswers.js';
import {restorePostureStats} from '../src/models/postureStats.js';
test('posture restoration retains newer alert counts and validates local counters',()=>{
 assert.deepEqual(restorePostureStats({samples:10,good_samples:8,alerts:2},{samples:12,good_samples:9,alerts:3}),{samples:12,good_samples:9,alerts:3});
 assert.deepEqual(restorePostureStats({samples:10,good_samples:8,alerts:2},{samples:-1,good_samples:100,alerts:'bad'}),{samples:10,good_samples:8,alerts:2});
 assert.deepEqual(restorePostureStats(null,null),{samples:0,good_samples:0,alerts:0});
});
test('legacy goal is normalized without losing other answers or accepting unknown choices',()=>{
 const questions=[{key:'goals',options:[{value:'comfort'},{value:'posture'}]}];
 const original={goals:['reduce_pain','posture','comfort'],device:['laptop']};
 assert.deepEqual(normalizeOnboardingAnswers(original,questions),{goals:['comfort','posture'],device:['laptop']});
 assert.deepEqual(original.goals,['reduce_pain','posture','comfort']);
 assert.deepEqual(normalizeOnboardingAnswers({goals:['unknown']},questions).goals,['unknown']);
 assert.deepEqual(normalizeOnboardingAnswers(original,[{key:'goals',options:[{value:'reduce_pain'}]}]).goals,original.goals);
});
import {BODY_ZONES,confirmSelection,updateSelection,completeAssessment,allowedZone} from '../src/models/bodyZones.js';
const detail=intensity=>({discomfort:true,intensity,location:'Вся область',side:'center',sensations:['tension'],timing:'during_work',episode_duration:'minutes',duration:'weeks',frequency:'daily',context:'task',impact:'none',injury:'no'});
test('all ten selected areas stay in the assessment',()=>{const input={zones:Object.fromEntries(BODY_ZONES.map(z=>[z.id,{discomfort:true}]))};const confirmed=confirmSelection(input);assert.equal(confirmed.priority.length,10);assert.equal(Object.values(confirmed.zones).filter(z=>z.discomfort).length,10);assert.equal(confirmed.completed,false);});
test('completion requires an independent answer in every selected area',()=>{const value=confirmSelection({zones:Object.fromEntries(BODY_ZONES.map((z,i)=>[z.id,detail(i%6)]))});assert.equal(completeAssessment(value),true);value.zones.feet.intensity=null;assert.equal(completeAssessment(value),false);assert.equal(value.zones.head.intensity,0);assert.equal(value.zones.neck.intensity,1);});
test('changing one selected area does not overwrite other assessments',()=>{const value={zones:{neck:detail(2),wrists:detail(5)}};const next=updateSelection(value,'neck');assert.equal(next.zones.neck.discomfort,false);assert.equal(next.zones.wrists.intensity,5);assert.equal(value.zones.neck.intensity,2);});
test('risk and recent injury prevent automatic selection',()=>{assert.equal(allowedZone({...detail(3),injury:'yes'}),false);assert.equal(allowedZone({...detail(3),sensations:['numbness']}),false);assert.equal(allowedZone(detail(5)),false);assert.equal(allowedZone(detail(2)),true);});
test('saving a second diary area retains the first area and its assessment',()=>{
 const first=mergeDiaryArea({},'neck',{intensity:3,safety:'no',feelings:['ноет']});
 const second=mergeDiaryArea(first,'lower_back',{intensity:2,safety:'no',feelings:[]});
 assert.deepEqual(second.neck,first.neck);assert.equal(second.lower_back.intensity,2);assert.equal(Object.keys(second).length,2);assert.equal(Object.keys(first).length,1);
});
test('missing intensity or safety does not produce a diary payload',()=>{
 for(const d of [{intensity:null,safety:'no'},{intensity:6,safety:'no'},{intensity:2,safety:null}])assert.throws(()=>mergeDiaryArea({},'neck',d));
});
test('progress is chronological and does not connect through missing days',()=>{
 const values=dailySeries([{date:'2026-10-05',zones:{neck:{intensity:2}}},{date:'2026-10-03',zones:{neck:{intensity:3}}}],'neck','2026-10-03','2026-10-05');
 assert.deepEqual(values.map(p=>p.value),[3,null,2]);assert.deepEqual(values.map(p=>p.date),['03.10','04.10','05.10']);
});
