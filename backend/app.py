import json, os, re, ssl, uuid, time
import certifi
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from concurrent.futures import ThreadPoolExecutor
from functools import wraps
from flask import Flask, request, jsonify, g
try:
 from . import assistant
 from .personalization import ZONES, visible, allowed_zone, make_plan
except ImportError:
 import assistant
 from personalization import ZONES, visible, allowed_zone, make_plan
ROOT=Path(__file__).resolve().parent.parent
loaded_env={}
for env_file in (ROOT/'.env',ROOT/'.env.local'):
 if env_file.exists():
  for line in env_file.read_text().splitlines():
   if '=' in line and not line.startswith('#'):
    k,v=line.split('=',1);loaded_env[k]=v.strip().strip('"').strip("'")
for k,v in loaded_env.items():os.environ.setdefault(k,v)
URL=os.getenv('SUPABASE_URL',os.getenv('VITE_SUPABASE_URL','')).rstrip('/')
KEY=os.getenv('SUPABASE_PUBLISHABLE_KEY',os.getenv('VITE_SUPABASE_ANON_KEY',''))
app=Flask(__name__);app.config['MAX_CONTENT_LENGTH']=150_000
class ApiError(Exception):
 def __init__(self,message,status=400):self.message=message;self.status=status
@app.errorhandler(ApiError)
def fail(e):return jsonify(error=e.message),e.status
@app.errorhandler(413)
def too_big(_):return jsonify(error='Слишком большой запрос.'),413
@app.errorhandler(500)
def server_error(_):return jsonify(error='Не удалось выполнить запрос. Повторите позже.'),500
@app.after_request
def headers(response):
 response.headers['Cache-Control']='no-store';response.headers['X-Content-Type-Options']='nosniff';return response

def remote(path,token,method='GET',body=None,prefer=None):
 if not URL or not KEY:raise ApiError('Не настроено подключение сервера к БД.',503)
 h={'apikey':KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'}
 if prefer:h['Prefer']=prefer
 req=Request(URL+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
 try:
  with urlopen(req,timeout=20,context=ssl.create_default_context(cafile=os.getenv("SSL_CERT_FILE",certifi.where()))) as response:
   raw=response.read();return json.loads(raw) if raw else None
 except HTTPError as e:
  if e.code in (401,403):raise ApiError('Доступ запрещён. Войдите заново или проверьте права.',e.code)
  if e.code==409:raise ApiError('Запись уже существует. Обновите экран.',409)
  app.logger.warning('Supabase request failed: %s %s',path.split('?')[0],e.code)
  raise ApiError('Не удалось сохранить или загрузить данные. Повторите запрос.',502)
 except (URLError,TimeoutError):raise ApiError('Нет соединения с базой данных. Повторите позже.',503)

def table(name,query=None,method='GET',body=None,prefer=None,token=None):
 return remote('/rest/v1/'+name+('?' + urlencode(query) if query else ''),token or g.token,method,body,prefer)
def auth(fn):
 @wraps(fn)
 def run(*args,**kwargs):
  header=request.headers.get('Authorization','')
  if not header.startswith('Bearer '):raise ApiError('Требуется вход.',401)
  g.token=header[7:];g.user=remote('/auth/v1/user',g.token)
  rows=table('profiles',{'id':'eq.'+g.user['id'],'select':'id,full_name,email,role,is_blocked,onboarding_completed'})
  if not rows or rows[0]['is_blocked']:raise ApiError('Учётная запись недоступна.',403)
  g.profile=rows[0]
  return fn(*args,**kwargs)
 return run

def payload():
 data=request.get_json(silent=True)
 if not isinstance(data,dict):raise ApiError('Ожидается объект JSON.')
 return data

def integer(value,low,high,label):
 if isinstance(value,bool) or not isinstance(value,int) or not low<=value<=high:raise ApiError(label)
 return value

def valid_date(value):
 try:d=date.fromisoformat(value)
 except (ValueError,TypeError):raise ApiError('Некорректная дата.')
 if d>datetime.now(timezone.utc).date()+timedelta(days=1):raise ApiError('Дата не может быть в будущем.')
 return d.isoformat()

def validate_zones(zones,full=False):
 if not isinstance(zones,dict) or set(zones)-set(ZONES):raise ApiError('Некорректные области тела.')
 for key,d in zones.items():
  if not isinstance(d,dict):raise ApiError('Некорректная оценка области.')
  integer(d.get('intensity'),0,5,'Интенсивность должна быть от 0 до 5.')
  if 'safety' in d and d['safety'] not in ('yes','no','unsure'):raise ApiError('Некорректный ответ о безопасности.')
  if not full and d.get('safety') not in ('yes','no','unsure'):raise ApiError('Ответьте на уточнение для каждой области.')
  if full and not isinstance(d.get('discomfort'),bool):raise ApiError('Подтвердите наличие или отсутствие дискомфорта.')
  if full and not d.get('discomfort'):
   if d['intensity']!=0:raise ApiError('Интенсивность неотмеченной области должна быть нулевой.')
   zones[key]={'discomfort':False,'intensity':0,'exercise_auto_selection_allowed':True};continue
  if full and d.get('discomfort'):
   for k in ('location','side','timing','duration','frequency','context','impact','injury'):
    if not d.get(k):raise ApiError('Заполните подробную оценку каждой выбранной области.')
   if not isinstance(d.get('location'),str) or len(d['location'])>200:raise ApiError('Проверьте локализацию.')
   if d['side'] not in ('left','right','both','center','unsure'):raise ApiError('Проверьте сторону области.')
   if d['injury'] not in ('yes','no','unsure'):raise ApiError('Ответьте на вопрос о травме.')
   if not isinstance(d.get('sensations'),list) or not d['sensations'] or set(d['sensations'])-{'pressure','aching','pulsing','heaviness','sharp','tension','stiffness','burning','tingling','numbness','other'}:raise ApiError('Укажите характер ощущения.')
   if set(d['sensations'])&{'sharp','numbness','tingling'} and not d.get('safety'):raise ApiError('Ответьте на уточнение безопасности.')
  d['exercise_auto_selection_allowed']=allowed_zone(d)
 return zones

def definitions():return [r['definition'] for r in table('survey_questions',{'is_active':'eq.true','order':'order_index.asc'}) if r.get('definition',{}).get('key')]

def validate_answers(a):
 if not isinstance(a,dict) or a.get('consent') is not True:raise ApiError('Подтвердите согласие на сохранение ответов.')
 questions=definitions()
 goals=next((q for q in questions if q['key']=='goals'),None)
 allowed_goals={o['value'] for o in (goals or {}).get('options',[])}
 if isinstance(a.get('goals'),list) and all(isinstance(v,str) for v in a['goals']) and 'comfort' in allowed_goals and 'reduce_pain' not in allowed_goals:
  a['goals']=list(dict.fromkeys('comfort' if v=='reduce_pain' else v for v in a['goals']))
 for q in questions:
  if not visible(q,a):continue
  v=a.get(q['key'])
  if q.get('required') and (v is None or v=='' or v==[]):raise ApiError('Ответьте на вопрос: '+q['label'])
  if v is None:continue
  allowed=[o['value'] for o in q.get('options',[])]
  if q['type']=='multi' and (not isinstance(v,list) or any(x not in allowed for x in v)):raise ApiError('Обновите выбранные варианты в вопросе: '+q['label'])
  if q['type']=='multi' and q.get('max_choices') and len(v)>q['max_choices']:raise ApiError('Выберите не больше '+str(q['max_choices'])+' вариантов.')
  if q['type']=='single' and v not in allowed:raise ApiError('Обновите выбранный вариант в вопросе: '+q['label'])
  if q['type']=='number':integer(v,q.get('min',0),q.get('max',100),'Проверьте числовой ответ.')
  if q['type']=='time' and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',str(v)):raise ApiError('Укажите время.')
 if len(a.get('device',[]))>1 and a.get('primary_device') not in a['device']:raise ApiError('Основное устройство должно быть среди выбранных.')
 if a.get('schedule')=='stable' and a.get('start_time')==a.get('end_time'):raise ApiError('Начало и окончание работы должны различаться.')
 bm=a.get('body_map',{})
 if not bm.get('confirmed') or not bm.get('completed') or set(bm.get('zones',{}))!=set(ZONES):raise ApiError('Завершите оценку областей тела.')
 if a.get('limitations') not in ('none','injury','restriction','unsure'):raise ApiError('Укажите ограничения для самостоятельной активности.')
 validate_zones(bm['zones'],True)
 a['schema_version']=2
 return a

@app.get('/api/health')
def health():return jsonify(status='ok',configured=bool(URL and KEY))
@app.get('/api/assistant/status')
@auth
def assistant_status():
 return jsonify(available=assistant.configured(),mode='ai' if assistant.configured() else 'guided')
@app.post('/api/assistant/chat')
@auth
def assistant_chat():
 try:question,history=assistant.validate_chat(payload())
 except ValueError as e:raise ApiError(str(e))
 if not assistant.configured():raise ApiError('Свободные ответы ИИ ещё не подключены. Подсказки по плану доступны в окне Лео.',503)
 if not assistant.allow_request(g.user['id']):raise ApiError('Лео нужно немного времени. Попробуйте через минуту.',429)
 data=bootstrap.__wrapped__().get_json()
 context=assistant.plan_context(data['plan'],data['logs'],data['sessions'],data['diary'])
 usage={};started=time.monotonic();status='invalid_response'
 try:
  text=assistant.answer(question,history,context,usage_sink=usage.update);status='success';return jsonify(answer=text)
 except (HTTPError,URLError,TimeoutError):
  status='provider_error';raise ApiError('Сервис ИИ сейчас недоступен. Попробуйте позже; подсказки по плану продолжают работать.',503)
 except (ValueError,KeyError,TypeError):raise ApiError('Лео не смог подготовить ответ. Попробуйте ещё раз.',502)
 finally:
  tokens={k:usage[k] if isinstance(usage.get(k),int) and not isinstance(usage.get(k),bool) and 0<=usage[k]<=1000000 else None for k in ('input_tokens','output_tokens')}
  try:table('ai_request_events',None,'POST',dict(user_id=g.user['id'],status=status,model=(os.getenv('OPENAI_MODEL','').strip() or 'gpt-4.1-mini')[:100],latency_ms=min(120000,int((time.monotonic()-started)*1000)),**tokens))
  except ApiError:app.logger.warning('AI metrics could not be saved')
@app.get('/api/bootstrap')
@auth
def bootstrap():
 owner='eq.'+g.user['id'];token=g.token
 specs={'surveys':('surveys',{'user_id':owner,'survey_type':'eq.initial','order':'created_at.desc','limit':'1'}),
 'drafts':('onboarding_drafts',{'user_id':owner}),'diary':('diary_entries',{'user_id':owner,'order':'date.desc','limit':'365'}),
 'exercises':('exercises',{'is_active':'eq.true'}),'articles':('articles',{'is_active':'eq.true'}),
 'questions':('survey_questions',{'is_active':'eq.true','order':'order_index.asc'}),'rules':('recommendation_rules',{'is_active':'eq.true'}),
 'body_zones':('body_zones',{'order':'order_index.asc'}),'settings':('system_settings',{'key':'eq.max_exercises'}),
 'logs':('exercise_logs',{'user_id':owner,'order':'completed_at.desc','limit':'1000'}),'sessions':('working_sessions',{'user_id':owner,'order':'started_at.desc','limit':'365'})}
 with ThreadPoolExecutor(max_workers=6) as pool:
  futures={k:pool.submit(table,t,q,token=token) for k,(t,q) in specs.items()}
  data={k:f.result() for k,f in futures.items()}
 answers=data['surveys'][0]['answers'] if data['surveys'] else {}
 data.update(profile=g.profile,answers=answers,draft=data.pop('drafts')[0] if data['drafts'] else None)
 data['questions']=[q['definition'] for q in data['questions'] if q['definition'].get('key')]
 plan_date=valid_date(request.args.get('plan_date') or date.today().isoformat())
 data['plan']=make_plan(answers,data['exercises'],data['diary'],data.pop('rules'),{'logs':data['logs'],'sessions':data['sessions'],'plan_date':plan_date})
 data['plan']['eligible_exercise_ids']=[ex['id'] for ex in data['exercises'] if make_plan(answers,[ex],data['diary'],[],{'logs':data['logs'],'plan_date':plan_date})['exercises']]
 max_items=next((r['value'] for r in data.pop('settings') if r['key']=='max_exercises'),5)
 if isinstance(max_items,int) and 1<=max_items<=10:data['plan']['exercises']=data['plan']['exercises'][:max_items]
 return jsonify(data)
@app.put('/api/onboarding/draft')
@auth
def save_draft():
 p=payload();integer(p.get('step'),0,10,'Некорректный этап.')
 if not isinstance(p.get('answers'),dict):raise ApiError('Некорректные ответы.')
 result=table('onboarding_drafts',{'on_conflict':'user_id'},'POST',dict(user_id=g.user['id'],step=p['step'],answers=p['answers'],updated_at=datetime.now(timezone.utc).isoformat()),'resolution=merge-duplicates,return=representation')
 return jsonify(result[0])
@app.post('/api/onboarding/complete')
@auth
def complete():
 p=payload();a=validate_answers(p.get('answers'));d=valid_date(p.get('date'))
 result=remote('/rest/v1/rpc/complete_onboarding',g.token,'POST',{'p_answers':a,'p_date':d})
 return jsonify(id=result)
@app.put('/api/diary')
@auth
def diary():
 p=payload();d=valid_date(p.get('date'));change=p.get('overall_change')
 if change not in ('better','same','worse','first'):raise ApiError('Укажите изменение самочувствия.')
 note=p.get('note','')
 if not isinstance(note,str) or len(note)>2000:raise ApiError('Заметка слишком длинная.')
 zones=validate_zones(p.get('zones',{}))
 result=table('diary_entries',{'on_conflict':'user_id,date'},'POST',dict(user_id=g.user['id'],date=d,overall_change=change,zones=zones,note=note),'resolution=merge-duplicates,return=representation')
 return jsonify(result[0])
@app.delete('/api/diary/<uuid:entry_id>')
@auth
def delete_diary(entry_id):
 table('diary_entries',{'id':'eq.'+str(entry_id),'user_id':'eq.'+g.user['id']},'DELETE');return jsonify(ok=True)
@app.post('/api/exercises/<uuid:exercise_id>/complete')
@auth
def exercise_complete(exercise_id):
 p=payload();d=valid_date(p.get('date'))
 ex=table('exercises',{'id':'eq.'+str(exercise_id),'is_active':'eq.true'})
 if not ex:raise ApiError('Упражнение недоступно.',404)
 surveys=table('surveys',{'user_id':'eq.'+g.user['id'],'survey_type':'eq.initial','order':'created_at.desc','limit':'1'})
 diary=table('diary_entries',{'user_id':'eq.'+g.user['id'],'order':'date.desc','limit':'1'})
 answers=surveys[0]['answers'] if surveys else {}
 logs=table('exercise_logs',{'user_id':'eq.'+g.user['id'],'exercise_id':'eq.'+str(exercise_id),'order':'date.desc'})
 safe_plan=make_plan(answers,[ex[0]],diary,[],{'logs':logs,'plan_date':d})
 if not safe_plan['exercises']:raise ApiError('Это движение не подходит текущим ответам или ограничениям. Обновите план.',409)
 existing=table('exercise_logs',{'exercise_id':'eq.'+str(exercise_id),'user_id':'eq.'+g.user['id'],'date':'eq.'+d})
 if existing:return jsonify(existing[0])
 result=table('exercise_logs',None,'POST',dict(user_id=g.user['id'],exercise_id=str(exercise_id),date=d,duration_seconds=ex[0]['duration_seconds']),'return=representation')
 return jsonify(result[0])
@app.patch('/api/exercise-logs/<uuid:log_id>')
@auth
def exercise_feedback(log_id):
 p=payload();feeling=p.get('feeling')
 if feeling not in ('better','same','worse'):raise ApiError('Выберите, как изменилось самочувствие.')
 rows=table('exercise_logs',{'id':'eq.'+str(log_id),'user_id':'eq.'+g.user['id']},'PATCH',{'feedback':feeling},'return=representation')
 if not rows:raise ApiError('Запись о выполнении не найдена.',404)
 return jsonify(rows[0])
@app.post('/api/sessions')
@auth
def start_session():
 p=payload();interval=integer(p.get('interval_minutes'),10,120,'Выберите интервал от 10 до 120 минут.')
 active=table('working_sessions',{'user_id':'eq.'+g.user['id'],'state':'neq.finished'})
 if active:return jsonify(active[0])
 return jsonify(table('working_sessions',None,'POST',dict(user_id=g.user['id'],interval_minutes=interval,next_break_work_seconds=interval*60),'return=representation')[0])
@app.patch('/api/sessions/<uuid:session_id>')
@auth
def update_session(session_id):
 p=payload();state=p.get('state')
 if state not in ('working','paused','break','finished'):raise ApiError('Некорректное состояние сессии.')
 existing=table('working_sessions',{'id':'eq.'+str(session_id),'user_id':'eq.'+g.user['id']})
 if not existing:raise ApiError('Сессия не найдена.',404)
 if existing[0]['state']=='finished':raise ApiError('Сессия уже завершена.',409)
 out={'state':state,'updated_at':datetime.now(timezone.utc).isoformat()}
 for k in ('work_seconds','break_seconds','breaks_completed'):
  out[k]=integer(p.get(k,existing[0][k]),existing[0][k],10_000_000,'Счётчики сессии должны возрастать.')
 for k in ('next_break_work_seconds','break_started_seconds'):
  if k in p:out[k]=integer(p[k],0,10_000_000,'Некорректный счётчик.')
 posture=p.get('posture',{})
 if not isinstance(posture,dict) or any(k not in ('samples','good_samples','alerts') for k in posture):raise ApiError('Некорректная статистика положения тела.')
 previous=existing[0].get('posture') or {}
 for key,value in posture.items():integer(value,previous.get(key,0),10_000_000,'Счётчики камеры должны возрастать.')
 out['posture']={**previous,**posture}
 if out['posture'].get('good_samples',0)>out['posture'].get('samples',0):raise ApiError('Проверьте количество наблюдений камеры.')
 if state=='finished':out['ended_at']=datetime.now(timezone.utc).isoformat()
 rows=table('working_sessions',{'id':'eq.'+str(session_id),'user_id':'eq.'+g.user['id']},'PATCH',out,'return=representation')
 return jsonify(rows[0])
@app.patch('/api/profile')
@auth
def profile():
 p=payload();name=p.get('full_name','').strip()
 if not 1<=len(name)<=100:raise ApiError('Имя должно содержать от 1 до 100 символов.')
 return jsonify(table('profiles',{'id':'eq.'+g.user['id']},'PATCH',{'full_name':name},'return=representation')[0])
@app.get('/api/export')
@auth
def export():
 return bootstrap()

ADMIN_TABLES={'exercises':{'title','body_zone','difficulty','duration_seconds','description','instructions','target_zones','repetitions','limitations','applicability','source_url','media_url','is_active'},
 'articles':{'title','category','content','target_zones','source_url','is_active'},
 'survey_questions':{'question_text','question_type','question_key','definition','order_index','is_active'},
 'recommendation_rules':{'body_zone','target_zone','min_pain','max_pain','max_difficulty','max_items','priority','condition','recommendation','reason','source_url','is_active'},
 'body_zones':{'label','description'},'system_settings':{'key','value'},'profiles':{'is_blocked'}}
def admin(scope='owner'):
 if g.profile['role']!='admin':raise ApiError('Требуются права администратора.',403)
 if not hasattr(g,'admin_level'):
  access=table('admin_access',{'user_id':'eq.'+g.user['id'],'select':'access_level'})
  g.admin_level=access[0]['access_level'] if access else 'owner'
 if g.admin_level!='owner' and not (g.admin_level=='editor' and scope=='content') and not (g.admin_level=='support' and scope in ('support','diagnostics')):raise ApiError('Эта операция недоступна вашей административной роли.',403)

@app.get('/api/admin/access')
@auth
def admin_access():
 if g.profile['role']!='admin':raise ApiError('Требуются права администратора.',403)
 access=table('admin_access',{'user_id':'eq.'+g.user['id'],'select':'access_level'})
 return jsonify(level=access[0]['access_level'] if access else 'owner')

@app.patch('/api/admin/access/<item_id>')
@auth
def assign_admin_access(item_id):
 admin();p=payload()
 try:uuid.UUID(item_id)
 except ValueError:raise ApiError('Некорректный идентификатор.')
 if item_id==g.user['id'] or p.get('level') not in ('owner','editor','support'):raise ApiError('Нельзя менять собственную административную роль.')
 profiles=table('profiles',{'id':'eq.'+item_id,'select':'id,role'})
 if not profiles or profiles[0]['role']!='admin':raise ApiError('Назначение доступно существующим администраторам. Новые администраторы создаются доверенным оператором.')
 return jsonify(table('admin_access',None,'POST',{'user_id':item_id,'access_level':p['level']},'resolution=merge-duplicates,return=representation'))

@app.get('/api/admin/diagnostics')
@auth
def admin_diagnostics():
 admin('diagnostics')
 table('body_zones',{'limit':'1','select':'id'})
 events=table('ai_request_events',{'select':'status,model,input_tokens,output_tokens,latency_ms,created_at','order':'created_at.desc','created_at':'gte.'+(datetime.now(timezone.utc)-timedelta(days=30)).isoformat(),'limit':'1000'})
 return jsonify(system={'database':'connected','ai_configured':assistant.configured(),'model':os.getenv('OPENAI_MODEL','gpt-4.1-mini')},metrics={'requests':len(events),'success':sum(e['status']=='success' for e in events),'errors':sum(e['status']!='success' for e in events),'input_tokens':sum(e.get('input_tokens') or 0 for e in events),'output_tokens':sum(e.get('output_tokens') or 0 for e in events),'usage_reported':sum(e.get('input_tokens') is not None for e in events)},recent=events[:20])

@app.get('/api/admin/workspace')
@auth
def admin_workspace():
 admin('content')
 try:
  from .admin_workspace import quality
 except ImportError:
  from admin_workspace import quality
 exercises=table('exercises',{'limit':'500'})
 articles=table('articles',{'limit':'500'})
 return jsonify(**quality(exercises,articles),system={'database':'connected','ai_configured':assistant.configured(),'model':os.getenv('OPENAI_MODEL','gpt-4.1-mini'),'catalog_limit':500})

@app.post('/api/admin/simulate')
@auth
def admin_simulate():
 admin('content');p=payload()
 try:
  from .admin_workspace import simulate
 except ImportError:
  from admin_workspace import simulate
 if not isinstance(p.get('zones'),list) or any(z not in ZONES for z in p['zones']):raise ApiError('Некорректные области.')
 if not isinstance(p.get('goals'),list) or any(z not in ('comfort','posture','movement','exercises','breaks','workplace','eyes') for z in p['goals']):raise ApiError('Некорректные цели.')
 integer(p.get('minutes'),1,30,'Время: 1–30 минут.');integer(p.get('intensity'),0,5,'Интенсивность: 0–5.')
 if p.get('safety') not in ('no','yes','unsure') or p.get('space') not in ('seated','standing','walking') or p.get('limitations') not in ('none','yes'):raise ApiError('Проверьте условия сценария.')
 try:date.fromisoformat(p.get('date'))
 except (TypeError,ValueError):raise ApiError('Некорректная дата сценария.')
 settings=table('system_settings',{'key':'eq.max_exercises'})
 limit=int(settings[0]['value']) if settings else 5
 return jsonify(simulate(p,table('exercises',{'limit':'500'}),table('recommendation_rules',{'limit':'500'}),limit))
@app.get('/api/admin/<resource>')
@auth
def admin_list(resource):
 admin('support' if resource=='support_tickets' else 'content' if resource in ('exercises','articles','survey_questions','body_zones','recommendation_rules','system_settings','content_versions') else 'owner')
 if resource not in ADMIN_TABLES and resource not in ('admin_events','content_versions','support_tickets'):raise ApiError('Неизвестный раздел.',404)
 q={'select':'id,email,full_name,role,is_blocked,created_at'} if resource=='profiles' else {'limit':'500'}
 if resource in ('admin_events','content_versions','support_tickets'):q['order']='created_at.desc'
 rows=table(resource,q)
 if resource=='profiles':
  access={r['user_id']:r['access_level'] for r in table('admin_access',{'select':'user_id,access_level'})}
  for row in rows:
   if row['role']=='admin':row['admin_level']=access.get(row['id'],'owner')
 return jsonify(rows)

@app.route('/api/support',methods=['GET','POST'])
@auth
def support():
 if request.method=='GET':return jsonify(table('support_tickets',{'user_id':'eq.'+g.user['id'],'order':'created_at.desc','limit':'50'}))
 p=payload()
 if not isinstance(p.get('subject'),str) or not 1<=len(p['subject'].strip())<=150 or not isinstance(p.get('message'),str) or not 1<=len(p['message'].strip())<=3000:raise ApiError('Тема: до 150 символов, сообщение: до 3000.')
 return jsonify(table('support_tickets',None,'POST',{'user_id':g.user['id'],'subject':p['subject'].strip(),'message':p['message'].strip()},'return=representation'))

@app.post('/api/admin/restore')
@auth
def restore_version():
 admin('content');p=payload()
 integer(p.get('version_id'),1,2**53-1,'Некорректная версия.');integer(p.get('expected_revision'),1,2**53-1,'Некорректная текущая версия.')
 return jsonify(remote('/rest/v1/rpc/restore_content_version',g.token,'POST',{'version_id':p['version_id'],'expected_revision':p['expected_revision']}))

@app.patch('/api/admin/tickets/<item_id>')
@auth
def ticket_reply(item_id):
 admin('support');p=payload()
 try:uuid.UUID(item_id)
 except ValueError:raise ApiError('Некорректный идентификатор.')
 if p.get('status') not in ('open','in_progress','closed') or not isinstance(p.get('reply'),str) or len(p['reply'])>3000:raise ApiError('Проверьте статус и ответ.')
 return jsonify(table('support_tickets',{'id':'eq.'+item_id},'PATCH',{'status':p['status'],'reply':p['reply'].strip(),'updated_at':datetime.now(timezone.utc).isoformat()},'return=representation'))
@app.route('/api/admin/<resource>',methods=['POST'])
@app.route('/api/admin/<resource>/<item_id>',methods=['PATCH','DELETE'])
@auth
def admin_write(resource,item_id=None):
 admin('owner' if resource=='profiles' else 'content')
 if resource not in ADMIN_TABLES:raise ApiError('Неизвестный раздел.',404)
 if resource=='body_zones' and request.method!='PATCH':raise ApiError('Структура карты закреплена.')
 if resource=='profiles' and (request.method!='PATCH' or item_id==g.user['id']):raise ApiError('Эта операция недоступна.')
 pk='key' if resource=='system_settings' else 'id'
 if item_id and pk=='id' and resource!='body_zones':
  try:uuid.UUID(item_id)
  except ValueError:raise ApiError('Некорректный идентификатор.')
 p=payload() if request.method!='DELETE' else None
 if p is not None and (set(p)-ADMIN_TABLES[resource]):raise ApiError('Недопустимые поля.')
 if p and resource=='system_settings' and p.get('key')=='max_exercises':integer(p.get('value'),1,10,'Максимум упражнений: от 1 до 10.')
 if p and resource=='system_settings' and item_id=='max_exercises' and 'value' in p:integer(p['value'],1,10,'Максимум упражнений: от 1 до 10.')
 if p and resource=='exercises':
  if 'target_zones' in p and (not isinstance(p['target_zones'],list) or set(p['target_zones'])-set(ZONES)):raise ApiError('Некорректные целевые области.')
  if 'duration_seconds' in p:integer(p['duration_seconds'],10,3600,'Длительность: 10–3600 секунд.')
  for k in ('media_url','source_url'):
   if p.get(k) and not p[k].startswith('https://'):raise ApiError('Ссылка должна начинаться с https://')
 if p and resource=='recommendation_rules':
  existing=table(resource,{'id':'eq.'+item_id}) if item_id else []
  merged={**(existing[0] if existing else {}),**p}
  if merged.get('is_active'):
   try:from .recommendation_validation import rule_error
   except ImportError:from recommendation_validation import rule_error
   error=rule_error(merged,definitions())
   if error:raise ApiError(error)
 if p and resource=='survey_questions' and 'definition' in p:
  d=p['definition']
  if not isinstance(d,dict) or not d.get('key') or not d.get('label') or d.get('type') not in ('single','multi','number','time','text'):raise ApiError('Проверьте определение вопроса.')
  if d.get('section') not in ('about','work','place','screen','habits','goals','preferences'):raise ApiError('Неизвестный этап опроса.')
  if item_id:
   existing=table(resource,{'id':'eq.'+item_id})
   previous=(existing[0].get('definition') or {}) if existing else {}
   if previous.get('key') and previous['key']!=d['key']:raise ApiError('Ключ существующего вопроса закреплён. Создайте новый вопрос, чтобы сохранить совместимость ответов.')
   if previous.get('type') and previous['type']!=d['type']:raise ApiError('Тип существующего вопроса закреплён. Создайте новый вопрос для другого типа ответа.')
   old_values={str(o.get('value')) for o in previous.get('options',[])}
   new_values={str(o.get('value')) for o in d.get('options',[])}
   if old_values-new_values:raise ApiError('Нельзя удалять сохранённые значения ответов. Можно менять подписи или добавлять варианты.')
 if p and resource in ('exercises','articles'):
  existing=table(resource,{'id':'eq.'+item_id}) if item_id else []
  merged={**(existing[0] if existing else {}),**p}
  if merged.get('is_active'):
   required=['title','source_url','instructions' if resource=='exercises' else 'content']
   if any(not isinstance(merged.get(k),str) or not merged[k].strip() for k in required) or not merged['source_url'].startswith('https://'):raise ApiError('Для публикации нужны название, текст и HTTPS-источник.')
   if resource=='exercises' and (not merged.get('target_zones') or not (merged.get('applicability') or {}).get('space')):raise ApiError('Для публикации укажите целевые области и условия выполнения.')
 result=table(resource,{pk:'eq.'+item_id} if item_id else None,request.method,p,'return=representation')
 if resource=='profiles':table('admin_events',None,'POST',{'actor_id':g.user['id'],'action':request.method,'resource':resource})
 return jsonify(result)
if __name__=='__main__':app.run(host='127.0.0.1',port=int(os.getenv('PORT','5001')),debug=False)
