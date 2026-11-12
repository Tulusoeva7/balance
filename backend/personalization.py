"""Explainable preventive planning. These rules are not diagnostic thresholds."""
from datetime import date
ZONES = ['head','neck','shoulders','upper_back','lower_back','elbows','wrists','hips','knees','feet']
LABELS = dict(zip(ZONES,['Голова','Шея','Плечи','Верх спины','Поясница','Локти / предплечья','Кисти / запястья','Таз / бёдра','Колени','Стопы']))
RISK_SENSATIONS = {'sharp','numbness','tingling'}

def visible(question, answers):
    condition = question.get('when')
    if not condition: return True
    value = answers.get(condition['key'])
    if 'equals' in condition: return value == condition['equals']
    if 'not' in condition: return value is not None and value != condition['not']
    if 'contains' in condition: return condition['contains'] in (value or [])
    if 'any' in condition: return bool(set(value or []) & set(condition['any']))
    if 'count_greater' in condition: return isinstance(value,list) and len(value)>condition['count_greater']
    return False

def allowed_zone(detail):
    sensations = detail.get('sensations') or [detail.get('sensation')]
    if isinstance(sensations,str):sensations=[sensations]
    intensity=detail.get('intensity')
    if isinstance(intensity,bool) or not isinstance(intensity,int) or not 0<=intensity<=5:return False
    return intensity<4 and not RISK_SENSATIONS.intersection(sensations) and detail.get('safety') not in ('yes','unsure','unknown') and detail.get('injury') not in ('yes','unsure') and detail.get('impact')!='limits'

def make_plan(answers, exercises, diary, rules, activity=None):
    zones = answers.get('body_map',{}).get('zones',{})
    configured=answers.get('schema_version')==2
    latest = sorted(diary,key=lambda e:e['date'],reverse=True)[:1]
    current = latest[0].get('zones',{}) if latest else {}
    blocked = {z for z,d in zones.items() if d.get('discomfort') and not allowed_zone(d)}
    blocked.update(z for z,d in current.items() if not allowed_zone(d))
    if 'head' in blocked:blocked.add('neck')
    restricted = answers.get('limitations') not in (None,'none')
    worsen = bool(latest and latest[0]['overall_change']=='worse')
    recommendations=[]
    def add(key,title,reason,factors,kind='workplace',description=None):
        descriptions={
            'routine':'Используйте эту рекомендацию как ориентир, а не как жёсткое расписание. Начните с небольшого изменения в обычном рабочем дне и при необходимости подстройте его под занятия, встречи и задачи.',
            'break':'Во время короткой паузы не обязательно выполнять упражнение: можно встать, пройтись, изменить положение тела или ненадолго отвести взгляд от экрана. Важно прежде всего прервать длительный период одной и той же деятельности.',
            'workplace':'Проверьте этот пункт во время обычной работы, не стараясь специально принять «идеальную» позу. Задача — найти более удобную организацию рабочего места и периодически менять положение.',
            'tracking':'Сделайте короткую запись, когда снова заметите эти ощущения. Несколько записей помогут сравнивать изменения во времени, не делая выводов о причине дискомфорта.',
            'safety':'Автоматический план в этой ситуации действует осторожно и не пытается определить причину ощущений. Не выполняйте действия через выраженный или необычный дискомфорт.'
        }
        recommendations.append(dict(id=key,title=title,description=description or descriptions.get(kind,descriptions['workplace']),reason=reason,source_factors=factors,kind=kind))
    interval=int(answers.get('break_interval',45)); minutes=int(answers.get('break_minutes',3))
    add('routine',f'Перерыв через {interval} минут на {minutes} мин.', 'Вы выбрали такой интервал. Его можно менять под встречи и занятия.', ['break_interval','break_minutes','work_days','schedule','start_time','end_time','hours'], 'routine')
    devices=answers.get('device',[])
    if isinstance(devices,str): devices=[devices]
    if answers.get('screen_height') in ('low','high') or answers.get('screen_position')=='side':
        add('screen','Проверьте положение основного экрана','Вы указали неудобную высоту или положение сбоку. Попробуйте удобную высоту и экран перед собой.',['screen_height','screen_position','screens'])
    if 'laptop' in devices and answers.get('external_screen')!='yes' and answers.get('keyboard')!='yes':
        add('laptop','Настройте ноутбук и положение рук','Вы используете экран ноутбука без отдельной клавиатуры. Подберите удобный компромисс высоты экрана и положения рук; при возможности попробуйте отдельную клавиатуру.',['device','external_screen','keyboard','stand'])
    if set(devices)&{'phone','tablet'}:
        add('mobile','Подберите опору для мобильного устройства','Вы работаете на телефоне или планшете. Опора помогает не держать устройство постоянно в руках и менять положение.',['device','primary_device','stand'])
    if answers.get('hands') in ('bent','unsupported') or answers.get('mouse')=='trackpad':
        add('hands','Проверьте опору рук и устройство ввода','По вашим ответам полезно попробовать удобную опору предплечий, прямое положение кистей и устройство ввода рядом.',['hands','mouse','keyboard'])
    if answers.get('chair')!='standing' and answers.get('back_support') in ('no','unsure'):
        add('back','Найдите удобную опору спины','Вы не отметили комфортную опору для спины. Попробуйте настройки стула и регулярно меняйте положение.',['chair','back_support'])
    if answers.get('feet_support')=='no' or answers.get('leg_space')=='no':
        add('feet','Освободите место для ног и проверьте опору стоп','Вы указали недостаточную опору или мало места. Попробуйте освободить пространство и подобрать устойчивую опору.',['feet_support','leg_space'])
    if answers.get('screen_distance')=='close' or answers.get('glare')=='yes':
        add('light','Попробуйте размер текста и освещение','Вы приближаетесь к экрану или замечаете блики. Увеличьте текст и попробуйте другое положение света.',['screen_distance','glare'])
    if answers.get('eye_fatigue') in ('often','sometimes') or 'eyes' in answers.get('goals',[]):
        add('eyes','Во время паузы отведите взгляд от экрана','Вы отметили зрительную усталость или выбрали её своей целью. Чередуйте работу за экраном с другой деятельностью.',['eye_fatigue','eye_symptoms','goals'],'break')
    if answers.get('vision_change') in ('yes','unsure'):
        add('vision','Обсудите изменение зрения со специалистом','Вы указали новое ухудшение зрения или не уверены в характере изменений. Автоматический план не оценивает их причину.',['vision_change'],'safety')
    if answers.get('continuous') in ('120','180') or answers.get('position_changes')=='rare':
        add('position','Начните с короткой смены деятельности','Вы долго работаете без смены положения. Привяжите небольшую паузу к завершению задачи.',['continuous','position_changes','hours'],'break')
    if set(answers.get('break_barriers',[]))&{'forget','focus','flow'}:
        add('remind','Запускайте рабочую сессию перед задачей','Вы указали, что можете забыть о паузе, увлечься задачей или не хотеть терять концентрацию. Таймер поможет помнить о паузе без постоянного контроля времени.',['break_barriers','notification'],'routine')
    if set(answers.get('break_barriers',[]))&{'meetings','schedule'}:
        add('flexible','Ставьте паузу между встречами и занятиями','Вы указали ограничения графика. Сессию можно приостановить и продолжить после встречи.',['break_barriers','occupation','schedule'],'routine')
    if 'movement' in answers.get('goals',[]) or (isinstance(answers.get('activity'),list) and ('sit' in answers.get('activity',[]) or 'none' in answers.get('activity',[]))):
        add('activity','Добавьте немного движения в один из перерывов','Вы хотите больше двигаться во время рабочего дня или обычно проводите короткую паузу без смены положения. Начните с одного простого действия: встать, немного пройтись или мягко изменить положение.',['activity','space','goals'],'break')
    if answers.get('sleep') in ('no','unsure'):
        add('rest','Выберите короткий план на сегодня','Вы выбрали минимальный или пока не определённый объём активности. Начнём с небольшого количества действий, которое можно изменить позже.',['sleep'],'routine')
    if blocked or restricted or worsen:
        add('safety','Не выполняйте движения, которые усиливают ощущения','Есть ограничения, настораживающие ответы или ухудшение в последней записи. Для отмеченных областей автоматический подбор приостановлен. При новых или усиливающихся ощущениях обсудите их со специалистом.', ['body_map','limitations','overall_change'],'safety')
    for zone_id,detail in zones.items():
        if not detail.get('discomfort'):continue
        if detail.get('duration')=='months' or detail.get('frequency')=='constant':
            add('persistent_'+zone_id,'Обсудите сохраняющиеся ощущения: '+LABELS.get(zone_id,zone_id),'Вы отмечаете длительные или постоянные ощущения. Индивидуальная консультация поможет определить подходящие вам действия.',['body_map.'+zone_id+'.duration','body_map.'+zone_id+'.frequency'],'safety')
        if detail.get('timing') in ('during_work','after_work','evening') and detail.get('context'):
            add('observe_'+zone_id,'Сравните ощущения в области «'+LABELS.get(zone_id,zone_id)+'» после рабочего дня','Вы отметили: «'+detail['context']+'». Короткая запись после работы поможет сравнивать интенсивность при этом условии, без предположений о причине.',['body_map.'+zone_id+'.timing','body_map.'+zone_id+'.context'],'tracking')
    for r in rules:
        cond=r.get('condition') or {}
        if r.get('is_active') and cond.get('key') and visible({'when':cond},answers) and r.get('recommendation'):
            add(r['id'],r['recommendation'],r.get('reason') or 'На основании вашего ответа.',[cond['key']], 'routine' if cond['key']=='schedule' else 'workplace',description=r.get('reason'))
    activity=activity or {}
    logs=activity.get('logs',[])
    sessions=[s for s in activity.get('sessions',[]) if s.get('state')=='finished'][:3]
    if logs:
        add('completed','Сохраняйте удобный вам небольшой объём',f'Вы отметили выполнение {len(logs)} действий. Выполнение сохраняется в плане и прогрессе; добавлять нагрузку через усилие не требуется.',['exercise_logs'],'routine')
    if len(sessions)>=3 and sum(s.get('breaks_completed',0) for s in sessions)==0:
        add('session_feedback','Попробуйте один полноценный перерыв в следующей сессии','В последних трёх завершённых сессиях нет завершённых перерывов. Попробуйте короткую паузу между задачами.',['working_sessions','break_barriers'],'routine')
    recommendations.sort(key=lambda r:0 if r['kind']=='safety' else 1 if r['kind']=='routine' else 2)
    selected={z for z,d in zones.items() if d.get('discomfort')} | {z for z,d in current.items() if d.get('intensity',0)>0}
    goals=set(answers.get('goals',[]))
    goal_labels={'breaks':'Регулярные перерывы','movement':'Больше движения','comfort':'Самочувствие','exercises':'Короткие упражнения','workplace':'Удобное рабочее место','posture':'Контроль положения тела','eyes':'Комфорт при работе с экраном'}
    # A reported area takes precedence; spare time is not a reason to add unrelated movements.
    focus=selected or ({'neck','shoulders','upper_back','lower_back'} if 'posture' in goals else set())
    general_movement=not focus and bool(goals & {'movement','exercises','breaks'})
    last_done={}
    latest_feedback={}
    plan_day=date.fromisoformat(activity.get('plan_date') or date.today().isoformat())
    today=plan_day.isoformat()
    for log in logs:
        key=log.get('exercise_id')
        if log.get('date','')<today:last_done[key]=max(last_done.get(key,''),log.get('date',''))
        if log.get('feedback') and log.get('date','')>=latest_feedback.get(key,{}).get('date',''):
            latest_feedback[key]=log
    ordered=sorted((ex for ex in exercises if (set(ex.get('target_zones') or [ex.get('body_zone')])&focus or general_movement)),key=lambda e:(e.get('title',''),str(e.get('id',''))))
    offset=plan_day.toordinal()%len(ordered) if ordered else 0
    rotation={id(ex):i for i,ex in enumerate(ordered[offset:]+ordered[:offset])}
    def priority(ex):
        targets=set(ex.get('target_zones') or [ex.get('body_zone')])
        previous=last_done.get(ex.get('id'),'')
        return (0 if targets&focus else 1,previous,rotation[id(ex)])
    budget=int(answers.get('available_minutes',5))*60
    if answers.get('sleep') in ('no','unsure'):budget=min(budget,120)
    picked=[]; used=0
    for ex in sorted(ordered,key=priority):
        targets=set(ex.get('target_zones') or [ex.get('body_zone')])
        if not targets&focus and not general_movement:continue
        feedback=latest_feedback.get(ex.get('id'),{})
        reassessed=bool(latest and latest[0]['date']>feedback.get('date','') and latest[0].get('overall_change')=='better' and any(z in current and allowed_zone(current[z]) for z in targets) and not targets&blocked)
        if feedback.get('feedback')=='worse' and not reassessed:
            add('feedback_'+str(ex.get('id')),'Упражнение приостановлено: '+ex.get('title',''),'После этого упражнения вы отметили менее комфортное состояние. Не повторяйте его через дискомфорт; Если позже состояние улучшилось, сохраните новую оценку этой области и отметьте «Комфортнее» в сравнении с прошлой записью. При сохраняющихся или усиливающихся ощущениях обсудите их со специалистом.',['exercise_logs','diary'],'safety')
            continue
        if not configured or not ex.get('is_active') or restricted or worsen or targets&blocked:continue
        if ex.get('difficulty')!='easy':continue
        if answers.get('space','seated') not in ex.get('applicability',{}).get('space',['seated','standing','walking']):continue
        if used+ex['duration_seconds']>budget:continue
        reason='Вы отметили '+', '.join(LABELS[z] for z in ZONES if z in targets&selected)+'.' if targets&selected else 'Подобрано для выбранной цели: '+', '.join(label for key,label in goal_labels.items() if key in goals)+'.'
        reason+=' Учитываются доступное место, время и ограничения; выбираются только лёгкие упражнения.'
        relevant=next((z for z in ZONES if z in targets&selected and z in zones),None)
        if relevant:
            detail=zones[relevant];side={'left':'слева','right':'справа','both':'с обеих сторон','center':'по центру','unsure':'сторону не удалось определить'}.get(detail.get('side'),'')
            reason+=' Вы указали '+str(detail.get('intensity',0))+'/5'+(', '+side if side else '')+(' · '+detail['location'] if detail.get('location') else '')+'.'
        picked.append(dict(**ex,reason=reason,source_factors=['body_map','space','available_minutes','limitations'],blocked=False));used+=ex['duration_seconds']
    covered=set().union(*(set(ex.get('target_zones') or [ex.get('body_zone')]) for ex in picked)) if picked else set()
    uncovered=[LABELS[z] for z in ZONES if z in focus-covered]
    blocked_focus=[LABELS[z] for z in ZONES if z in focus&blocked]
    if blocked_focus:
        selection_note='Для областей «'+', '.join(blocked_focus)+'» автоматический подбор приостановлен из-за интенсивности или ответа о безопасности. Проверьте последнюю запись дневника и первоначальную оценку через «Изменить ответы»: ограничения первоначальной оценки сохраняются до её обновления и не выполняйте движения через выраженный или необычный дискомфорт.'
    elif uncovered:
        selection_note='Для областей «'+', '.join(uncovered)+'» сейчас нет подходящего упражнения в выбранном объёме. Проверьте доступное время и рекомендации; упражнения для других областей вместо них не добавляются.'
    else:
        selection_note=''
    return dict(plan_date=today,recommendations=recommendations,exercises=picked,blocked_zones=sorted(blocked),focus_zones=[LABELS[z] for z in ZONES if z in focus],goal_labels=[label for key,label in goal_labels.items() if key in goals],selection_note=selection_note,interval_minutes=interval,break_minutes=minutes,budget_minutes=budget//60,work_days=answers.get('work_days',['1','2','3','4','5']),generated_from='initial + latest diary + active content',version=2,needs_update=not configured)
