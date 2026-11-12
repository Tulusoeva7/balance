import unittest
from unittest.mock import patch
from backend.admin_workspace import quality, simulate
from backend.app import app

EX=[dict(id='neck',title='Шея',body_zone='neck',target_zones=['neck'],is_active=True,difficulty='easy',duration_seconds=60,instructions='Шаг',source_url='https://example.invalid',applicability={'space':['seated']}),dict(id='feet',title='Стопы',body_zone='feet',target_zones=['feet'],is_active=True,difficulty='easy',duration_seconds=60,instructions='Шаг',source_url='https://example.invalid',applicability={'space':['seated']})]
SCENARIO=dict(goals=['comfort'],zones=['neck'],minutes=5,intensity=2,safety='no',space='seated',limitations='none',date='2026-10-05')
class AdminWorkspaceTests(unittest.TestCase):
 def test_focus_does_not_fill_with_unrelated_exercise(self):
  result=simulate(SCENARIO,EX,[])
  self.assertEqual([r['id'] for r in result['plan']['exercises']],['neck'])
  self.assertIn('Не соответствует',result['excluded'][0]['reason'])
 def test_unsure_or_high_intensity_never_substitutes_feet(self):
  for changes in ({'safety':'unsure'},{'intensity':5}):
   result=simulate(dict(SCENARIO,**changes),EX,[])
   self.assertFalse(result['plan']['exercises'])
   self.assertIn('приостановлен',next(r['reason'] for r in result['excluded'] if r['id']=='neck'))
 def test_head_does_not_implicitly_select_neck(self):
  self.assertFalse(simulate(dict(SCENARIO,zones=['head']),EX,[])['plan']['exercises'])
 def test_coverage_counts_only_published_easy_content(self):
  result=quality(EX+[dict(EX[0],id='draft',is_active=False),dict(EX[0],id='hard',difficulty='hard')],[])
  self.assertEqual(next(r for r in result['coverage'] if r['id']=='neck')['count'],1)
  self.assertEqual(next(r for r in result['coverage'] if r['id']=='head')['count'],0)
 def test_quality_distinguishes_draft_from_published_issue(self):
  result=quality([dict(EX[0],source_url='',is_active=False)],[])
  self.assertFalse(result['issues'][0]['published']);self.assertIn('Нет HTTPS-источника',result['issues'][0]['issues'])
 def test_admin_role_matrix_and_no_personal_diary_queries(self):
  client=app.test_client()
  for level,urls in [('owner',{'/api/admin/profiles':200,'/api/admin/workspace':200,'/api/admin/support_tickets':200}),('editor',{'/api/admin/profiles':403,'/api/admin/workspace':200,'/api/admin/support_tickets':403}),('support',{'/api/admin/profiles':403,'/api/admin/workspace':403,'/api/admin/support_tickets':200,'/api/admin/diagnostics':200})]:
   calls=[]
   def db(name,*args,**kwargs):
    calls.append(name)
    if name=='profiles':return [{'id':'admin','role':'admin','is_blocked':False}]
    if name=='admin_access':return [{'user_id':'admin','access_level':level}]
    return []
   with patch('backend.app.remote',return_value={'id':'admin'}),patch('backend.app.table',side_effect=db):
    for url,status in urls.items():self.assertEqual(client.get(url,headers={'Authorization':'Bearer fixture'}).status_code,status,(level,url))
   self.assertFalse(set(calls)&{'diary_entries','surveys','exercise_logs','working_sessions'})
 def test_invalid_simulation_and_publication_rejected(self):
  def db(name,*args,**kwargs):
   if name=='profiles':return [{'id':'admin','role':'admin','is_blocked':False}]
   if name=='admin_access':return []
   return []
  with patch('backend.app.remote',return_value={'id':'admin'}),patch('backend.app.table',side_effect=db):
   client=app.test_client();headers={'Authorization':'Bearer fixture'}
   self.assertEqual(client.post('/api/admin/simulate',headers=headers,json=dict(SCENARIO,intensity=6)).status_code,400)
   self.assertEqual(client.post('/api/admin/exercises',headers=headers,json={'is_active':True,'title':'Неполная карточка'}).status_code,400)
   self.assertEqual(client.patch('/api/admin/access/admin',headers=headers,json={'level':'support'}).status_code,400)
 def test_user_cannot_read_versions_or_other_tickets(self):
  with patch('backend.app.remote',return_value={'id':'user'}),patch('backend.app.table',return_value=[{'id':'user','role':'user','is_blocked':False}]):
   for url in ('/api/admin/content_versions','/api/admin/support_tickets','/api/admin/diagnostics','/api/admin/access'):
    self.assertEqual(app.test_client().get(url,headers={'Authorization':'Bearer fixture'}).status_code,403)
