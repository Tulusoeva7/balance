// Preserve known answers from older questionnaires without accepting unknown values.
export function normalizeOnboardingAnswers(answers,questions){
 const next={...answers};
 const goals=questions.find(q=>q.key==='goals');
 const allowed=new Set((goals?.options||[]).map(o=>o.value));
 if(Array.isArray(next.goals))next.goals=[...new Set(next.goals.map(value=>value==='reduce_pain'&&!allowed.has(value)&&allowed.has('comfort')?'comfort':value))];
 return next;
}
