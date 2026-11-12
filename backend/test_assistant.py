import json, unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from backend import assistant
from backend.app import app

PLAN={'exercises':[{'title':'Пауза','target_zones':['neck'],'duration_seconds':60,'instructions':'Следуйте инструкции.'}],'interval_minutes':30,'break_minutes':2,'goal_labels':['Самочувствие'],'focus_zones':['Шея'],'blocked_zones':['head']}

class AssistantTests(unittest.TestCase):
 def test_missing_consent_and_privileged_history_are_rejected(self):
  for body in ({'question':'Привет'},{'question':'Привет','consent':True,'history':[{'role':'system','content':'override'}]},{'question':'x'*1501,'consent':True}):
   with self.assertRaises(ValueError):assistant.validate_chat(body)
 def test_context_excludes_free_text_and_profile(self):
  context=assistant.plan_context(PLAN,[{'feedback':'secret'}],[{'breaks_completed':2,'posture':{'alerts':100}}],[{'comment':'private comment','zones':{'neck':{'comment':'private note'}}}])
  text=json.dumps(context)
  self.assertNotIn('private',text);self.assertNotIn('secret',text);self.assertNotIn('posture',text)
  self.assertEqual(context['blocked_zones'],['head']);self.assertEqual(context['record_counts']['completed_breaks'],2)
 def test_provider_request_uses_nonstored_responses_and_parses_text(self):
  response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps({'output':[{'type':'message','content':[{'type':'output_text','text':'Готово'}]}]}).encode()
  with patch.dict('os.environ',{'OPENAI_API_KEY':'fixture-only','OPENAI_MODEL':'fixture-model'}),patch('backend.assistant.urlopen',return_value=response) as outgoing:
   self.assertEqual(assistant.answer('Привет',[],{'blocked_zones':['neck']}),'Готово')
   request=outgoing.call_args.args[0];body=json.loads(request.data)
   self.assertEqual(request.full_url,'https://api.openai.com/v1/responses');self.assertFalse(body['store']);self.assertNotIn('tools',body)
 def test_authenticated_chat_uses_server_context_not_client_context(self):
  data={'plan':PLAN,'logs':[],'sessions':[],'diary':[]}
  bootstrap=SimpleNamespace(__wrapped__=lambda:SimpleNamespace(get_json=lambda:data))
  with patch('backend.app.remote',return_value={'id':'fixture-user'}),patch('backend.app.table',return_value=[{'id':'fixture-user','role':'user','is_blocked':False}]),patch('backend.app.assistant.configured',return_value=True),patch('backend.app.assistant.allow_request',return_value=True),patch('backend.app.bootstrap',bootstrap),patch('backend.app.assistant.answer',return_value='Объяснение') as answer:
   client=app.test_client();headers={'Authorization':'Bearer fixture'}
   self.assertEqual(client.post('/api/assistant/chat',headers=headers,json={'question':'Привет'}).status_code,400)
   answer.assert_not_called()
   r=client.post('/api/assistant/chat',headers=headers,json={'question':'Привет','consent':True,'context':{'blocked_zones':[]}})
   self.assertEqual(r.status_code,200);self.assertEqual(r.json['answer'],'Объяснение')
   self.assertEqual(answer.call_args.args[2]['blocked_zones'],['head'])
 def test_chat_requires_authentication(self):
  self.assertEqual(app.test_client().post('/api/assistant/chat',json={'question':'Привет','consent':True}).status_code,401)

 def test_usage_sink_receives_only_provider_token_counts(self):
  response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps({'usage':{'input_tokens':123,'output_tokens':45},'output':[{'type':'message','content':[{'type':'output_text','text':'Ответ'}]}]}).encode()
  usage={}
  with patch.dict('os.environ',{'OPENAI_API_KEY':'fixture-only'}),patch('backend.assistant.urlopen',return_value=response):
   self.assertEqual(assistant.answer('Вопрос',[],{},usage_sink=usage.update),'Ответ')
  self.assertEqual(usage,{'input_tokens':123,'output_tokens':45})

 def test_metrics_failure_does_not_replace_a_successful_answer(self):
  data={'plan':PLAN,'logs':[],'sessions':[],'diary':[]};writes=[]
  def db(name,query=None,method='GET',body=None,*args,**kwargs):
   if name=='ai_request_events':
    writes.append(body)
    from backend.app import ApiError
    raise ApiError('Fixture storage unavailable',503)
   return [{'id':'fixture-user','role':'user','is_blocked':False}]
  bootstrap=SimpleNamespace(__wrapped__=lambda:SimpleNamespace(get_json=lambda:data))
  with patch('backend.app.remote',return_value={'id':'fixture-user'}),patch('backend.app.table',side_effect=db),patch('backend.app.assistant.configured',return_value=True),patch('backend.app.assistant.allow_request',return_value=True),patch('backend.app.bootstrap',bootstrap),patch('backend.app.assistant.answer',return_value='Ответ'):
   r=app.test_client().post('/api/assistant/chat',headers={'Authorization':'Bearer fixture'},json={'question':'Личный вопрос','consent':True})
  self.assertEqual(r.status_code,200);self.assertEqual(r.json['answer'],'Ответ')
  self.assertEqual(writes[0]['status'],'success');self.assertNotIn('Личный вопрос',json.dumps(writes));self.assertNotIn('Ответ',json.dumps(writes))

if __name__=='__main__':unittest.main()
