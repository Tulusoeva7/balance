import json
import unittest
from unittest.mock import patch
from backend.app import app
from copy import deepcopy
from pathlib import Path
from backend.personalization import make_plan
from backend.recommendation_validation import rule_error

ROOT=Path(__file__).resolve().parent.parent
RULES=json.loads((ROOT/'database/recommendation_rules.json').read_text())
CONTENT=json.loads((ROOT/'database/content.json').read_text())

class RecommendationRulesTests(unittest.TestCase):
 def test_every_rule_matches_only_its_answer_and_exposes_action(self):
  for rule in RULES:
   with self.subTest(rule=rule['id']):
    self.assertIsNone(rule_error(rule,CONTENT['questions']))
    condition=rule['condition'];answer={condition['key']:condition['equals']}
    result=make_plan(answer,[],[],[rule])
    recommendation=next(r for r in result['recommendations'] if r['id']==rule['id'])
    self.assertEqual(recommendation['description'],rule['reason'])
    for other in ({},{condition['key']:'different-answer'}):
     self.assertNotIn(rule['id'],[r['id'] for r in make_plan(other,[],[],[rule])['recommendations']])
    self.assertNotIn(rule['id'],[r['id'] for r in make_plan(answer,[],[],[dict(rule,is_active=False)])['recommendations']])
 def test_rules_never_unlock_exercises_blocked_by_safety(self):
  for changes in ({'intensity':5},{'safety':'yes'},{'safety':'unsure'}):
   answers={'schema_version':2,'goals':['posture'],'limitations':'none','space':'seated','available_minutes':10,'screens':'2','chair':'sofa','body_map':{'zones':{'neck':dict(discomfort=True,intensity=2,safety='no',**{k:v for k,v in changes.items() if k not in ('intensity','safety')})}}}
   answers['body_map']['zones']['neck'].update(changes)
   base=make_plan(answers,CONTENT['exercises'],[],[])
   actual=make_plan(answers,CONTENT['exercises'],[],RULES)
   self.assertEqual(actual['exercises'],base['exercises'])
   self.assertEqual(actual['blocked_zones'],base['blocked_zones'])
 def test_invalid_and_empty_rules_cannot_be_published(self):
  rule=deepcopy(RULES[0])
  for changes in ({'recommendation':''},{'reason':''},{'source_url':''},{'condition':{}},{'condition':{'key':'screens','equals':'999'}},{'condition':{'key':'screens','contains':'2'}}):
   self.assertTrue(rule_error(dict(rule,**changes),CONTENT['questions']))

 def test_api_rejects_empty_publication_and_allows_disabling_legacy(self):
  rule_id='11111111-1111-4111-8111-111111111111'
  legacy=dict(id=rule_id,is_active=False,condition={},recommendation=None,reason=None)
  def db(name,*args,**kwargs):
   if name=='profiles':return [{'id':'admin','role':'admin','is_blocked':False}]
   if name=='admin_access':return [{'user_id':'admin','access_level':'owner'}]
   if name=='survey_questions':return [{'definition':q} for q in CONTENT['questions']]
   if name=='recommendation_rules':return [legacy]
   return []
  with patch('backend.app.remote',return_value={'id':'admin'}),patch('backend.app.table',side_effect=db):
   client=app.test_client();headers={'Authorization':'Bearer fixture'}
   response=client.patch('/api/admin/recommendation_rules/'+rule_id,headers=headers,json={'is_active':True})
   self.assertEqual(response.status_code,400)
   self.assertIn('рекомендацию',response.get_json()['error'])
   self.assertEqual(client.patch('/api/admin/recommendation_rules/'+rule_id,headers=headers,json={'is_active':False}).status_code,200)
