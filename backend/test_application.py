import copy, json, unittest
from pathlib import Path
from unittest.mock import patch
from backend.personalization import make_plan, allowed_zone, visible, ZONES
from backend.app import app, validate_answers, ApiError, validate_zones
CONTENT=json.loads((Path(__file__).resolve().parent.parent/'database/content.json').read_text())
def complete_answers():
 a={'consent':True,'schema_version':2}
 for q in CONTENT['questions']:
  if q['type']=='number':a[q['key']]=6
  elif q['type']=='time':a[q['key']]='09:00' if q['key']=='start_time' else '18:00'
  elif q['type']=='multi':a[q['key']]=[q['options'][0]['value']]
  else:a[q['key']]=q['options'][0]['value']
 a.update(limitations='none',space='seated',available_minutes='5',device=['laptop'],work_days=['1','2','3','4','5'])
 a['body_map']={'confirmed':True,'completed':True,'zones':{z:dict(discomfort=True,intensity=2,location='area',side='both',sensations=['tension'],timing='during_work',duration='weeks',frequency='daily',context='task',impact='none',injury='no') for z in ZONES}}
 return a
class PersonalizationTests(unittest.TestCase):
 def test_neck_focus_never_fills_budget_with_unrelated_exercises(self):
  a=complete_answers();a['goals']=['comfort'];a['sleep']='yes'
  a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=2) for z in ZONES}
  p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertTrue(p['exercises']);self.assertTrue(all('neck' in e['target_zones'] for e in p['exercises']))
 def test_fifteen_minute_budget_keeps_eight_minute_relevant_plan(self):
  a=complete_answers();a.update(available_minutes='15',goals=['comfort'],sleep='yes')
  a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=2) for z in ZONES}
  neck=dict(next(e for e in CONTENT['exercises'] if 'neck' in e['target_zones']),id='neck-eight',duration_seconds=480)
  feet=dict(next(e for e in CONTENT['exercises'] if 'feet' in e['target_zones']),id='feet-seven',duration_seconds=420)
  p=make_plan(a,[neck,feet],[],[])
  self.assertEqual([e['id'] for e in p['exercises']],['neck-eight'])
  self.assertEqual(sum(e['duration_seconds'] for e in p['exercises']),480)
 def test_unrelated_diary_does_not_clear_negative_feedback(self):
  a=complete_answers();a.update(sleep='yes',available_minutes='10')
  ex=dict(next(e for e in CONTENT['exercises'] if e['target_zones']==['neck']),id='neck-test')
  activity={'plan_date':'2026-10-19','logs':[{'exercise_id':'neck-test','date':'2026-10-17','feedback':'worse'}]}
  for entry in [dict(date='2026-10-18',overall_change='same',zones={}),dict(date='2026-10-18',overall_change='better',zones={'feet':{'intensity':1,'safety':'no'}})]:
   self.assertFalse(make_plan(a,[ex],[entry],[],activity)['exercises'])
  entry=dict(date='2026-10-18',overall_change='better',zones={'neck':{'intensity':1,'safety':'no'}})
  self.assertTrue(make_plan(a,[ex],[entry],[],activity)['exercises'])
 def test_unfavorable_exercise_feedback_pauses_that_exercise(self):
  a=complete_answers();base=dict(CONTENT['exercises'][0],id='neck-exercise')
  p=make_plan(a,[base],[],[],{'logs':[{'exercise_id':'neck-exercise','date':'2026-01-01','feedback':'worse'}]})
  self.assertFalse(p['exercises']);self.assertTrue(any(r['id']=='feedback_neck-exercise' for r in p['recommendations']))
 def test_blocked_neck_is_explained_without_substitution(self):
  a=complete_answers();a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=5) for z in ZONES}
  p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertFalse(p['exercises']);self.assertIn('Шея',p['selection_note']);self.assertIn('приостановлен',p['selection_note'])
 def test_head_does_not_implicitly_prescribe_neck_movement(self):
  a=complete_answers();a['body_map']['zones']={z:dict(discomfort=z=='head',intensity=2) for z in ZONES}
  p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertFalse(p['exercises']);self.assertIn('Голова',p['selection_note'])
 def test_posture_goal_selects_relevant_areas_without_discomfort(self):
  a=complete_answers();a['goals']=['posture'];a['sleep']='yes'
  a['body_map']['zones']={z:dict(discomfort=False,intensity=0) for z in ZONES}
  p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertTrue(p['exercises']);self.assertTrue(all(set(e['target_zones'])&{'neck','shoulders','upper_back','lower_back'} for e in p['exercises']))
 def test_recent_history_rotates_equivalent_options(self):
  a=complete_answers();a.update(available_minutes='1',sleep='yes',goals=['comfort'])
  a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=2) for z in ZONES}
  base=next(e for e in CONTENT['exercises'] if e['target_zones']==['neck'])
  first=dict(base,id='first',title='A');second=dict(base,id='second',title='B')
  first['duration_seconds']=second['duration_seconds']=60
  p=make_plan(a,[first,second],[],[],{'logs':[{'exercise_id':'first','date':'2020-01-01'}]})
  self.assertEqual(p['exercises'][0]['id'],'second')
  from datetime import date
  baseline=make_plan(a,[first,second],[],[],{'plan_date':date.today().isoformat()})
  p=make_plan(a,[first,second],[],[],{'logs':[{'exercise_id':'first','date':date.today().isoformat()}]})
  self.assertEqual(p['exercises'][0]['id'],baseline['exercises'][0]['id'])
 def test_calendar_rotates_relevant_variants_without_completion_history(self):
  a=complete_answers();a.update(available_minutes='1',sleep='yes',goals=['comfort'])
  a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=2) for z in ZONES}
  base=next(e for e in CONTENT['exercises'] if e['target_zones']==['neck'])
  variants=[dict(base,id='one',title='A',duration_seconds=60),dict(base,id='two',title='B',duration_seconds=60)]
  first=make_plan(a,variants,[],[],{'plan_date':'2026-10-05'})
  repeated=make_plan(a,list(reversed(variants)),[],[],{'plan_date':'2026-10-05'})
  next_day=make_plan(a,variants,[],[],{'plan_date':'2026-10-06'})
  self.assertEqual(first['exercises'][0]['id'],repeated['exercises'][0]['id'])
  self.assertNotEqual(first['exercises'][0]['id'],next_day['exercises'][0]['id'])
 def test_single_relevant_exercise_repeats_instead_of_unrelated_substitute(self):
  a=complete_answers();a['body_map']['zones']={z:dict(discomfort=z=='neck',intensity=2) for z in ZONES}
  for day in ('2026-10-05','2026-10-06'):
   p=make_plan(a,CONTENT['exercises'],[],[],{'plan_date':day})
   self.assertEqual(len(p['exercises']),1);self.assertEqual(p['exercises'][0]['target_zones'],['neck'])
 def test_legacy_goal_is_normalized_before_validation(self):
  a=complete_answers();a['goals']=['reduce_pain','posture','comfort']
  with patch('backend.app.definitions',return_value=CONTENT['questions']):result=validate_answers(a)
  self.assertEqual(result['goals'],['comfort','posture'])
 def test_unknown_goal_is_rejected_with_question_label(self):
  a=complete_answers();a['goals']=['not_a_goal']
  with patch('backend.app.definitions',return_value=CONTENT['questions']),self.assertRaisesRegex(ApiError,'Что вы хотите изменить'):validate_answers(a)
 def test_five_point_scale_and_high_intensity_restriction(self):
  self.assertTrue(allowed_zone({'intensity':3,'safety':'no'}))
  for intensity in (4,5,6):self.assertFalse(allowed_zone({'intensity':intensity,'safety':'no'}))
 def test_all_ten_zones_are_valid_independently(self):
  a=complete_answers();a['body_map']['zones']['head']['intensity']=3
  with patch('backend.app.definitions',return_value=CONTENT['questions']):result=validate_answers(a)
  self.assertEqual(len(result['body_map']['zones']),10);self.assertEqual(result['body_map']['zones']['neck']['intensity'],2)
 def test_missing_one_of_ten_is_rejected(self):
  a=complete_answers();del a['body_map']['zones']['feet']['duration']
  with patch('backend.app.definitions',return_value=CONTENT['questions']),self.assertRaises(ApiError):validate_answers(a)
 def test_risk_blocks_all_exercises_touching_that_zone(self):
  a=complete_answers();a['body_map']['zones']['shoulders']['sensations']=['numbness'];a['body_map']['zones']['shoulders']['safety']='no'
  plan=make_plan(a,CONTENT['exercises'],[],[])
  self.assertIn('shoulders',plan['blocked_zones']);self.assertTrue(all('shoulders' not in e['target_zones'] for e in plan['exercises']))
 def test_daily_worsening_pauses_activity(self):
  plan=make_plan(complete_answers(),CONTENT['exercises'],[{'date':'2026-01-01','overall_change':'worse','zones':{}}],[])
  self.assertFalse(plan['exercises']);self.assertTrue(any(r['kind']=='safety' for r in plan['recommendations']))
 def test_latest_daily_risk_is_applied(self):
  p=make_plan(complete_answers(),CONTENT['exercises'],[{'date':'2026-01-01','overall_change':'same','zones':{'neck':{'intensity':5,'safety':'no'}}}],[])
  self.assertIn('neck',p['blocked_zones']);self.assertTrue(all('neck' not in e['target_zones'] for e in p['exercises']))
 def test_restriction_disables_automatic_activity(self):
  a=complete_answers();a['limitations']='restriction';self.assertFalse(make_plan(a,CONTENT['exercises'],[],[])['exercises'])
 def test_space_and_budget(self):
  a=complete_answers();a['available_minutes']='2';p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertLessEqual(sum(e['duration_seconds'] for e in p['exercises']),120);self.assertFalse(any(e['title']=='Короткая прогулка' for e in p['exercises']))
 def test_rule_changes_recommendation_with_reason(self):
  a=complete_answers();r={'id':'custom','is_active':True,'condition':{'key':'device','contains':'laptop'},'recommendation':'custom advice','reason':'custom explanation'}
  p=make_plan(a,[],[],[r]);self.assertTrue(any(x['id']=='custom' and x['reason']=='custom explanation' for x in p['recommendations']))
 def test_adaptive_question_visibility(self):
  self.assertFalse(visible({'when':{'key':'device','contains':'laptop'}},{'device':['phone']}))
  self.assertTrue(visible({'when':{'key':'device','count_greater':1}},{'device':['phone','tablet']}))
 def test_invalid_intensity_and_zone_are_rejected(self):
  for data in [{'neck':{'intensity':6}},{'chest':{'intensity':2}},{'neck':{'intensity':True}}]:
   with self.assertRaises(ApiError):validate_zones(data)
 def test_malformed_safety_answer_cannot_bypass_restriction(self):
  a=complete_answers();a['body_map']['zones']['neck']['sensations']='numbness'
  with patch('backend.app.definitions',return_value=CONTENT['questions']),self.assertRaises(ApiError):validate_answers(a)
 def test_legacy_assessment_requires_update(self):
  a=complete_answers();a.pop('schema_version');p=make_plan(a,CONTENT['exercises'],[],[])
  self.assertTrue(p['needs_update']);self.assertFalse(p['exercises'])
 def test_session_history_changes_advice(self):
  p=make_plan(complete_answers(),[],[],[],{'sessions':[{'state':'finished','breaks_completed':0}]*3})
  self.assertTrue(any(r['id']=='session_feedback' for r in p['recommendations']))
class EndpointTests(unittest.TestCase):
 def test_assistant_reports_unavailable_and_never_makes_provider_request(self):
  with patch('backend.app.remote',return_value={'id':'owner'}) as remote,patch('backend.app.table',return_value=[{'id':'owner','role':'user','is_blocked':False}]):
   headers={'Authorization':'Bearer test'}
   r=self.client.get('/api/assistant/status',headers=headers)
   self.assertEqual(r.status_code,200);self.assertFalse(r.json['available'])
   r=self.client.post('/api/assistant/chat',headers=headers,json={'question':'Помоги','consent':True})
   self.assertEqual(r.status_code,503)
   self.assertTrue(all(c.args[0]=='/auth/v1/user' for c in remote.call_args_list))
 def test_camera_counters_are_saved_and_cannot_decrease(self):
  session={'id':'44444444-4444-4444-8444-444444444444','state':'working','work_seconds':60,'break_seconds':0,'breaks_completed':0,'posture':{'samples':10,'good_samples':8,'alerts':2}}
  writes=[]
  def db(name,query=None,method='GET',body=None,prefer=None,token=None):
   if name=='profiles':return [{'id':'owner','role':'user','is_blocked':False}]
   if method=='PATCH':writes.append(body);return [{**session,**body}]
   return [session]
  with patch('backend.app.remote',return_value={'id':'owner'}),patch('backend.app.table',side_effect=db):
   url='/api/sessions/'+session['id'];headers={'Authorization':'Bearer test'}
   self.assertEqual(self.client.patch(url,headers=headers,json={'state':'working','posture':{'samples':12,'good_samples':9,'alerts':3}}).status_code,200)
   self.assertEqual(writes[-1]['posture'],{'samples':12,'good_samples':9,'alerts':3})
   self.assertEqual(self.client.patch(url,headers=headers,json={'state':'working','posture':{'alerts':1}}).status_code,400)
   self.assertEqual(self.client.patch(url,headers=headers,json={'state':'working','posture':{'good_samples':11}}).status_code,400)
 def setUp(self):self.client=app.test_client()
 def test_no_token_cannot_read_or_write(self):
  self.assertEqual(self.client.get('/api/bootstrap').status_code,401)
  self.assertEqual(self.client.put('/api/diary',json={}).status_code,401)
  self.assertEqual(self.client.get('/api/admin/profiles').status_code,401)
 def test_user_cannot_access_admin(self):
  with patch('backend.app.remote',return_value={'id':'owner'}),patch('backend.app.table',return_value=[{'id':'owner','role':'user','is_blocked':False}]):
   self.assertEqual(self.client.get('/api/admin/profiles',headers={'Authorization':'Bearer test'}).status_code,403)
 def test_profile_update_restricts_to_owner_and_name(self):
  calls=[]
  def db(name,query=None,method='GET',body=None,prefer=None,token=None):
   calls.append((name,query,method,body));return [{'id':'owner','role':'user','is_blocked':False}]
  with patch('backend.app.remote',return_value={'id':'owner'}),patch('backend.app.table',side_effect=db):
   r=self.client.patch('/api/profile',headers={'Authorization':'Bearer test'},json={'full_name':'Test','role':'admin'})
   self.assertEqual(r.status_code,200);self.assertEqual(calls[-1][1],{'id':'eq.owner'});self.assertEqual(calls[-1][3],{'full_name':'Test'})
if __name__=='__main__':unittest.main()
