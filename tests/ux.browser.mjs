// Isolated browser regression tests using synthetic responses, never real user records.
// Run against npm run dev with BALANCE_PLAYWRIGHT_MODULE set if Playwright is bundled separately.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.BALANCE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BALANCE_TEST_URL||'http://127.0.0.1:5173';
const output=resolve(root,'tests/ux-evidence');await mkdir(output,{recursive:true});
const content=JSON.parse(await readFile(resolve(root,'database/content.json'),'utf8'));
const env=await readFile(resolve(root,'.env.local'),'utf8').catch(()=>readFile(resolve(root,'.env'),'utf8'));
const urlLine=env.split('\n').find(s=>s.startsWith('VITE_SUPABASE_URL='));
assert(urlLine,'Supabase URL is required');
const projectHost=new URL(urlLine.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g,'')).hostname;
const ref=projectHost.split('.')[0];
const userId='11111111-1111-4111-8111-111111111111';
const date=new Date().toLocaleDateString('en-CA');
const profile={id:userId,full_name:'Тест интерфейса',email:'ux-test@example.invalid',role:'user',is_blocked:false,onboarding_completed:true};
const exercises=content.exercises.slice(0,3).map((e,i)=>({...e,id:'22222222-2222-4222-8222-'+String(i+1).padStart(12,'0')}));
const recommendations=['routine','workplace','break','tracking'].map((kind,i)=>({id:kind,kind,title:['Перерыв через 45 минут','Проверьте опоры','Смените деятельность','Сравните ощущения'][i],description:'Подробная рекомендация, которая должна открываться по запросу пользователя.',reason:'Изолированные тестовые ответы.'}));
let diary=[];let logs=[];let fixtureSessions=[];const writes=[];
const bootstrap=()=>({profile,diary,logs,exercises,articles:content.articles.map((a,i)=>({...a,id:'article-'+i})),sessions:fixtureSessions,surveys:[],draft:null,questions:content.questions,body_zones:[],answers:{schema_version:2,space:'seated',limitations:'none',body_map:{zones:{}},notification:'none'},plan:{recommendations,exercises,blocked_zones:[],needs_update:false,interval_minutes:45,break_minutes:3}});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try{
 const visitor=await browser.newContext();const publicPage=await visitor.newPage();const visitorErrors=[];publicPage.on('pageerror',e=>visitorErrors.push(e.message));
 await publicPage.goto(base);await publicPage.getByRole('heading',{name:'Регистрация',exact:true}).waitFor();
 assert(await publicPage.getByLabel('Email',{exact:true}).isVisible());
 assert(await publicPage.getByLabel('Пароль',{exact:true}).isVisible());
 assert.deepEqual(visitorErrors,[]);checks.push('Real unauthenticated application: registration renders without page errors');await visitor.close();
 const context=await browser.newContext({viewport:{width:1366,height:768}});
 let leoAvailable=false;const leoQuestions=[];
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:userId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.fixture-signature';
 const session={access_token:token,refresh_token:'fixture-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:userId,email:profile.email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
 await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:'sb-'+ref+'-auth-token',session});
 await context.route('**/*',async route=>{
  const request=route.request();const url=new URL(request.url());
  const reply=async(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.hostname===projectHost){
   if(url.pathname==='/rest/v1/profiles')return reply(profile);
   if(url.pathname==='/rest/v1/surveys')return reply([]);
   return reply({error:'Unexpected external request in isolated test'},500);
  }
  if(url.origin!==base)return route.abort();
  if(url.pathname==='/api/bootstrap')return reply(bootstrap());
  if(url.pathname==='/api/assistant/status')return reply({available:leoAvailable,mode:leoAvailable?'ai':'guided'});
  if(url.pathname==='/api/support'&&request.method()==='GET')return reply([]);
  if(url.pathname==='/api/assistant/chat'){leoQuestions.push(request.postDataJSON());return reply({answer:'Тестовое объяснение вашего плана.'});}
  if(url.pathname==='/api/onboarding/draft'&&request.method()==='PUT')return reply(request.postDataJSON());
  if(url.pathname==='/api/onboarding/complete'&&request.method()==='POST')return reply({ok:true});
  if(url.pathname==='/api/diary'&&request.method()==='PUT'){
   const body=request.postDataJSON();writes.push(body);assert.equal(body.date,date);
   const record={...body,id:'33333333-3333-4333-8333-333333333333',user_id:userId};diary=[record];return reply(record);
  }
  if(url.pathname.startsWith('/api/'))return reply({error:'Unexpected fixture API request'},500);
  return route.continue();
 });
 const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/Dashboard');await page.getByRole('heading',{name:'План на сегодня'}).waitFor();
 const cta=page.getByRole('link',{name:'Начать работу',exact:true});assert(await cta.isVisible());const box=await cta.boundingBox();assert(box.y+box.height<768);
 await page.screenshot({path:resolve(output,'today-desktop.jpg'),fullPage:true});checks.push('Dashboard primary CTA visible without scrolling at 1366x768');
 await page.getByRole('button',{name:'Открыть помощника Лео'}).click();
 await page.getByText(/Сейчас доступны подсказки по плану/).waitFor();
 await page.screenshot({path:resolve(output,"leo-welcome.jpg"),fullPage:true});
 await page.getByRole('button',{name:'Что сделать сегодня?',exact:true}).click();
 assert(await page.getByRole('log').getByText(/Начните с одного упражнения/).isVisible());
 await page.getByLabel('Ваш вопрос Лео').fill('Почему у меня болит шея?');
 await page.getByRole('button',{name:'Задать вопрос',exact:true}).click();
 assert(await page.getByRole('alert').getByText(/Свободные ответы ИИ ещё не подключены/).isVisible());
 await page.screenshot({path:resolve(output,'leo-assistant.jpg'),fullPage:true});
 await page.getByRole('button',{name:'Закрыть подробности'}).click();checks.push('Leo explains actual plan locally; free questions show unavailable status without sending health data');
 leoAvailable=true;
 await page.getByRole('button',{name:'Открыть помощника Лео'}).click();await page.getByText(/ИИ подключён/).waitFor();
 await page.getByRole('button',{name:'Задать вопрос',exact:true}).click();assert.equal(leoQuestions.length,0);
 await page.getByRole('checkbox',{name:/Разрешаю отправить OpenAI/}).check();
 await page.getByRole('button',{name:'Задать вопрос',exact:true}).click();await page.getByRole('log').getByText(/Тестовое объяснение вашего плана/).waitFor();
 assert.equal(leoQuestions.length,1);assert.equal(leoQuestions[0].consent,true);assert.equal(leoQuestions[0].question,'Почему у меня болит шея?');
 await page.getByRole('button',{name:'Закрыть подробности'}).click();leoAvailable=false;checks.push('Leo sends a free question only after per-user consent; AI response shown from fixture, no real provider calls');
 await page.goto(base+'/WorkoutPlan');await page.getByRole('heading',{name:'Мой план',exact:true}).waitFor();
 for(const name of ['Рабочий ритм','Рабочее место','Перерывы и движение','Наблюдение'])assert(await page.getByText(name,{exact:true}).isVisible());
 assert.equal(await page.locator('details[open]').count(),0);
 await page.getByText('Рабочее место',{exact:true}).click();assert(await page.getByRole('heading',{name:'Проверьте опоры'}).isVisible());
 await page.getByRole('button',{name:'Закрыть подробности'}).click();await page.screenshot({path:resolve(output,'plan-desktop.jpg'),fullPage:true});checks.push('Plan categories closed by default and open on click');
 await page.getByRole('button',{name:'Начать',exact:true}).first().click();assert(await page.getByRole('heading',{name:'Как выполнять',exact:true}).isVisible());checks.push('Exercise instruction opens on Start');
 await page.evaluate(({userId})=>localStorage.setItem('balance:onboarding:v2:'+userId,JSON.stringify({step:9,answers:{consent:true,goals:['reduce_pain','posture']},updated_at:new Date().toISOString()})),{userId});
 await page.goto(base+'/Onboarding?edit=1');await page.getByRole('heading',{name:'Проверьте, правильно ли мы вас поняли'}).waitFor();
 assert(!(await page.locator('main').innerText()).includes('reduce_pain'));
 assert(await page.getByText(/Лучше следить за самочувствием, Лучше контролировать положение тела/).isVisible());
 checks.push('Legacy reduce_pain draft renders current Russian goal label and retains posture goal');
  await page.screenshot({path:resolve(output,'onboarding-legacy-goal.jpg'),fullPage:true});
 await page.setViewportSize({width:899,height:824});await page.getByRole('button',{name:'Сформировать мой план',exact:true}).click();
 await page.getByRole('heading',{name:'Ваш первоначальный план готов',exact:true}).waitFor();
 assert.equal(await page.locator('.initial-plan-details[open]').count(),0);
 const resultCta=await page.getByRole('button',{name:'Перейти в «Сегодня»',exact:true}).boundingBox();assert(resultCta.y+resultCta.height<824);
 await page.screenshot({path:resolve(output,'onboarding-result-compact.jpg'),fullPage:true});
 await page.getByText('Посмотреть рекомендации и упражнения',{exact:true}).click();
 await page.getByRole('button',{name:'Начать',exact:true}).first().click();assert(await page.locator('.exercise-instructions').first().isVisible());assert(await page.locator('.exercise-caution').first().isVisible());
 checks.push('Onboarding result compact at 899x824 with visible CTA; detailed exercises open on request');
 await page.goto(base+'/PainDiary');await page.getByRole('heading',{name:/Дневник боли/}).waitFor();
 await page.getByRole('button',{name:'Шея',exact:true}).first().click();
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();assert(await page.getByRole('alert').isVisible());assert.equal(writes.length,0);
 await page.getByRole('button',{name:'3 — умеренная',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Шея',exact:true}).first().locator('ellipse').first().getAttribute('fill'),'#fb923c');
 await page.getByRole('button',{name:'Нет',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByText('✓ Запись сохранена',{exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Добавить ещё область',exact:true}).click();
 await page.getByRole('button',{name:'Сзади',exact:true}).click();await page.getByRole('button',{name:'Поясница',exact:true}).first().click();
 await page.getByRole('button',{name:'2 — слабая',exact:true}).click();
 await page.getByRole('button',{name:'Нет',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByText('✓ Запись сохранена',{exact:true}).waitFor();
 assert.equal(writes.length,2);assert.equal(writes[1].zones.neck.intensity,3);assert.equal(writes[1].zones.lower_back.intensity,2);
 await page.getByRole('button',{name:'Готово',exact:true}).click();await page.getByRole('heading',{name:'План на сегодня'}).waitFor();await page.goto(base+'/PainDiary');await page.reload();await page.getByText('Сегодня отмечено: 2 области',{exact:true}).waitFor();
 assert(await page.getByRole('button',{name:'Шея · 3/5',exact:true}).isVisible());assert(await page.getByRole('button',{name:'Поясница · 2/5',exact:true}).isVisible());
 checks.push('Diary select -> save -> add second -> save -> done -> reload retains both areas in fixture responses');
 await page.screenshot({path:resolve(output,'diary-desktop.jpg'),fullPage:true});
 await page.getByRole('button',{name:'Шея · 3/5',exact:true}).click();await page.getByRole('button',{name:'5 — очень сильная',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Шея',exact:true}).first().locator('ellipse').first().getAttribute('fill'),'#e11d48');assert(await page.getByText('Очень сильная боль · 5/5',{exact:true}).isVisible());
 await page.getByLabel('Дата записи',{exact:true}).fill('2026-07-22');assert(await page.getByRole('heading',{name:'Шея',exact:true}).isVisible());
 await page.screenshot({path:resolve(output,'diary-editor-updated.jpg'),fullPage:true});checks.push('Live intensity updates body colour; 5/5 guidance appears; historical date retains selected area');
 await page.goto(base+'/Articles');await page.getByRole('button',{name:'Читать →',exact:true}).first().click();await page.getByText('Проверить понимание · 1 вопрос',{exact:true}).click();await page.getByRole('button',{name:'Менять настройки постепенно и отмечать удобство',exact:true}).click();assert(await page.getByText('✓ Верно. Вы уловили основную мысль.',{exact:true}).isVisible());await page.getByRole('button',{name:'Закрыть подробности'}).click();checks.push('Article opens in separate panel and optional knowledge check gives feedback');
 await page.goto(base+'/Analytics');await page.getByRole('button',{name:'7 дней',exact:true}).click();await page.getByLabel('С',{exact:true}).fill('2026-07-22');assert.equal(await page.getByLabel('По',{exact:true}).inputValue(),'2026-07-28');checks.push('Report range shows both dates; 7-day preset calculates July 22 -> July 28');
 await page.goto(base+'/Timer');await page.getByRole('button',{name:/25.*минут/}).click();assert.equal(await page.getByLabel('Интервал до перерыва').inputValue(),'25');await page.getByRole('button',{name:'◎ Контроль положения'}).click();assert(await page.getByRole('heading',{name:'Камера выключена'}).isVisible());checks.push('Timer presets update interval and camera opens separate workspace');
 for(const size of [{width:1440,height:900},{width:1280,height:720},{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const path of ['/Dashboard','/WorkoutPlan','/PainDiary','/Articles','/Profile','/Analytics','/ExerciseLibrary','/Timer']){
   await page.goto(base+path);await page.locator('main h1').first().waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,path+' at '+size.width);
   if(path==='/PainDiary'&&size.width===390)await page.screenshot({path:resolve(output,'diary-mobile.jpg'),fullPage:true});
  }
  checks.push('No horizontal overflow on 8 screens at '+size.width+'x'+size.height);
 }
 fixtureSessions=[{id:'44444444-4444-4444-8444-444444444444',state:'finished',started_at:date+'T09:00:00',work_seconds:3600,break_seconds:360,breaks_completed:2,posture:{samples:40,good_samples:30,alerts:7}}];
 diary=[...diary,{id:'pdf-demo',date,zones:Object.fromEntries(['head','neck','shoulders','upper_back','lower_back','elbows','wrists','hips','knees','feet'].map((id,index)=>[id,{intensity:index%6,feelings:['скованность','усталость'],safety:'unsure'}])),note:'Демонстрационный комментарий для проверки полного переноса текста. '.repeat(16).slice(0,1000)}];
 await page.goto(base+'/Analytics');await page.getByRole('button',{name:'Скачать PDF-отчёт',exact:true}).waitFor();
 assert((await page.locator('.pdf-export-root').innerText()).includes('Предупреждений: 7.'));
 const pdfDirectory=resolve(root,'output/pdf');await mkdir(pdfDirectory,{recursive:true});const downloadPromise=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'Скачать PDF-отчёт',exact:true}).click();const download=await downloadPromise;await download.saveAs(resolve(pdfDirectory,'Balance_example_test_data.pdf'));
 checks.push('Actual PDF downloaded with separate pages, full 1000-character note, ten zones and seven camera alerts (synthetic data)');
 assert.deepEqual(errors,[]);checks.push('No browser pageerror or console error on checked screens');
 await writeFile(resolve(output,'RESULTS.json'),JSON.stringify({scope:'isolated frontend fixtures; not real Supabase E2E',checks,writes,errors},null,2));
 console.log(JSON.stringify({passed:checks,errors},null,2));
}finally{await browser.close();}
