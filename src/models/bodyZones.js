export const BODY_ZONES = [
 {id:'head',label:'Голова'}, {id:'neck',label:'Шея'}, {id:'shoulders',label:'Плечи',paired:true},
 {id:'upper_back',label:'Верх спины',backOnly:true}, {id:'lower_back',label:'Поясница',backOnly:true},
 {id:'elbows',label:'Локти / предплечья',paired:true}, {id:'wrists',label:'Кисти / запястья',paired:true},
 {id:'hips',label:'Таз / бёдра',paired:true}, {id:'knees',label:'Колени',paired:true}, {id:'feet',label:'Стопы',paired:true},
];
export const SENSATIONS = {
 head:[['pressure','Давление / сдавливание'],['aching','Ноющие ощущения'],['pulsing','Пульсирующие ощущения'],['heaviness','Ощущение тяжести'],['sharp','Резкие ощущения']],
 neck:[['tension','Напряжение'],['stiffness','Скованность'],['aching','Ноющие ощущения'],['sharp','Резкие ощущения'],['burning','Жжение'],['tingling','Покалывание'],['numbness','Онемение']],
 wrists:[['tension','Напряжение'],['aching','Ноющие ощущения'],['burning','Жжение'],['tingling','Покалывание'],['numbness','Онемение'],['sharp','Резкие ощущения']],
};
export const DEFAULT_SENSATIONS=[['tension','Напряжение'],['stiffness','Скованность'],['aching','Ноющие ощущения'],['sharp','Резкие ощущения'],['tingling','Покалывание'],['numbness','Онемение']];
export const ZONE_DETAILS={
 head:{locations:['Лоб','Виски','Затылок','Область вокруг глаз','Одна сторона головы','В разных местах','Вся область'],context:'С чем чаще совпадают ощущения?',options:['Долгий взгляд на экран','Напряжённая задача','К концу дня','Закономерности не замечаю']},
 neck:{locations:['У основания головы','Сбоку шеи','Нижняя часть шеи','Вся область'],context:'При каком действии ощущения заметнее?',options:['Когда смотрю вниз','Когда поворачиваю голову','Когда долго не меняю положение','Закономерности не замечаю']},
 shoulders:{locations:['Верх плеч','Передняя часть плеч','Возле лопаток','Вся область'],context:'Когда ощущения заметнее?',options:['При поднятых руках','При работе мышью','Когда долго не меняю положение','Закономерности не замечаю']},
 upper_back:{locations:['Между лопатками','У лопатки','Выше лопаток','Вся область'],context:'При каком положении ощущения заметнее?',options:['При наклоне вперёд','При повороте корпуса','При долгом сидении','Закономерности не замечаю']},
 lower_back:{locations:['По центру поясницы','Сбоку поясницы','Нижняя часть спины','Вся область'],context:'В какой ситуации ощущения заметнее?',options:['После долгого сидения','После долгого стояния','При вставании','Закономерности не замечаю']},
 elbows:{locations:['В области локтя','В предплечье','Вся область'],context:'При каком действии ощущения заметнее?',options:['При опоре на локти','При работе мышью','При наборе текста','Закономерности не замечаю']},
 wrists:{locations:['В запястье','В ладони','В пальцах','Вся область'],context:'При какой работе ощущения заметнее?',options:['При наборе текста','При работе мышью или тачпадом','При удержании телефона','Закономерности не замечаю']},
 hips:{locations:['Сбоку бедра','В области таза','В передней части бедра','Вся область'],context:'Когда ощущения заметнее?',options:['После долгого сидения','При вставании','При ходьбе','Закономерности не замечаю']},
 knees:{locations:['Спереди колена','Сзади колена','Сбоку колена','Вся область'],context:'Когда ощущения заметнее?',options:['При согнутых ногах','При вставании','При ходьбе','Закономерности не замечаю']},
 feet:{locations:['В пятке','В стопе','В пальцах','Вся область'],context:'Когда ощущения заметнее?',options:['После долгого стояния','После долгого сидения','При ходьбе','Закономерности не замечаю']},
};
export function updateSelection(value,id){const current=value?.zones?.[id]||{};const selected=current.discomfort;return {...value,confirmed:false,completed:false,zones:{...value?.zones,[id]:{...current,discomfort:!selected}}};}
export function confirmSelection(value){const zones=Object.fromEntries(BODY_ZONES.map(({id})=>[id,value?.zones?.[id]?.discomfort?{...value.zones[id],discomfort:true}:{discomfort:false,intensity:0,exercise_auto_selection_allowed:true}]));const priority=BODY_ZONES.filter(z=>zones[z.id].discomfort).map(z=>z.id);return {...value,zones,priority,confirmed:true,completed:!priority.length};}
export function zoneComplete(d){return Number.isInteger(d?.intensity)&&d.intensity>=0&&d.intensity<=5&&d.location&&d.side&&d.sensations?.length&&d.timing&&d.episode_duration&&d.duration&&d.frequency&&d.context&&d.impact&&d.injury&&(!d.sensations.some(s=>['sharp','numbness','tingling'].includes(s))||d.safety);}
export function allowedZone(d){return d.intensity<4&&!d.sensations?.some(s=>['sharp','numbness','tingling'].includes(s))&&!['yes','unsure'].includes(d.safety)&&!['yes','unsure'].includes(d.injury)&&d.impact!=='limits';}
export function completeAssessment(v){return !!v?.confirmed&&BODY_ZONES.every(z=>v.zones?.[z.id]&&(!v.zones[z.id].discomfort||zoneComplete(v.zones[z.id])));}
