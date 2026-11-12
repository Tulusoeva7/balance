"""Admin diagnostics use catalog data and fictional scenarios, never user diaries."""
from copy import deepcopy
try:
 from .personalization import make_plan, ZONES, LABELS
except ImportError:
 from personalization import make_plan, ZONES, LABELS

def quality(exercises, articles):
 issues=[]
 for resource,rows in [('exercises',exercises),('articles',articles)]:
  for row in rows:
   missing=[]
   if not (row.get('source_url') or '').startswith('https://'):missing.append('Нет HTTPS-источника')
   if not str(row.get('instructions' if resource=='exercises' else 'content') or '').strip():missing.append('Нет инструкции' if resource=='exercises' else 'Нет текста')
   if resource=='exercises' and not row.get('target_zones'):missing.append('Не указаны целевые области')
   if missing:issues.append(dict(resource=resource,id=row['id'],title=row.get('title',''),published=bool(row.get('is_active')),issues=missing))
 coverage=[]
 for zone in ZONES:
  matching=[r for r in exercises if r.get('is_active') and zone in (r.get('target_zones') or [r.get('body_zone')]) and r.get('difficulty')=='easy']
  coverage.append(dict(id=zone,label=LABELS[zone],count=len(matching),seated=sum('seated' in (r.get('applicability') or {}).get('space',['seated','standing','walking']) for r in matching),titles=[r.get('title','') for r in matching]))
 return dict(issues=issues,coverage=coverage,exercise_count=len(exercises),article_count=len(articles))

def simulate(scenario, exercises, rules, max_items=5):
 answers={'schema_version':2,'goals':scenario['goals'],'space':scenario['space'],'available_minutes':scenario['minutes'],'limitations':scenario['limitations'],'sleep':'yes','break_interval':30,'break_minutes':2,'body_map':{'zones':{}}}
 for zone in scenario['zones']:
  answers['body_map']['zones'][zone]={'discomfort':True,'intensity':scenario['intensity'],'safety':scenario['safety'],'injury':'no','sensations':[]}
 activity={'plan_date':scenario['date'],'logs':[]}
 plan=make_plan(answers,exercises,[],rules,activity)
 plan['exercises']=plan['exercises'][:max_items]
 selected={r['id'] for r in plan['exercises']}
 # A one-item run through the same algorithm distinguishes ineligibility from
 # daily ordering/budget without reimplementing medical/safety selection rules.
 reasons=[]
 for row in exercises:
  if row['id'] in selected:continue
  probe=make_plan(deepcopy(answers),[row],[],[],activity)
  targets=set(row.get('target_zones') or [row.get('body_zone')])
  reason='Не соответствует отмеченным областям или выбранной цели'
  if not row.get('is_active'):reason='Черновик или отключено'
  elif targets & set(plan['blocked_zones']):reason='Подбор для этой области приостановлен по ответам о самочувствии'
  elif scenario['limitations']!='none':reason='Указаны общие ограничения'
  elif row.get('difficulty')!='easy':reason='Автоматический план выбирает только лёгкие упражнения'
  elif scenario['space'] not in (row.get('applicability') or {}).get('space',['seated','standing','walking']):reason='Не подходит для доступного места'
  elif row.get('duration_seconds',0)>scenario['minutes']*60:reason='Не помещается в доступное время'
  elif probe['exercises']:reason='Подходит, но осталось за пределами дневного объёма или лимита упражнений'
  reasons.append(dict(id=row['id'],title=row.get('title',''),reason=reason))
 return dict(plan=plan,excluded=reasons,fictional=True)
