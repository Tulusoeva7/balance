import {useState} from 'react';
const CHECKS={
 'Экран и рабочее место':{phrase:'Меняйте настройки постепенно',question:'Как удобнее подбирать рабочее место?',choices:['Менять настройки постепенно и отмечать удобство','Сразу менять всё рабочее место'],correct:0},
 'Руки и устройства ввода':{phrase:'Расположите мышь рядом с клавиатурой',question:'Где статья предлагает расположить мышь?',choices:['Как можно дальше от клавиатуры','Рядом с клавиатурой'],correct:1},
 'Перерывы, которые вписываются в день':{phrase:'Короткие регулярные паузы',question:'Что предлагается во время короткой паузы?',choices:['Продолжать ту же работу за экраном','Сменить деятельность или положение'],correct:1},
 'Когда стоит обсудить ощущения со специалистом':{phrase:'Не продолжайте движение',question:'Что делать с движением, которое усиливает боль?',choices:['Прекратить его','Продолжать через боль'],correct:0}
};
export default function ArticleCheck({article}){
 const [answer,setAnswer]=useState(null);const check=CHECKS[article.title];
 if(!check||!article.content.includes(check.phrase))return null;
 return <details className="article-check"><summary>Проверить понимание · 1 вопрос</summary><p className="font-semibold mt-4">{check.question}</p><div className="grid gap-2 mt-3">{check.choices.map((choice,index)=><button key={choice} className="app-button-secondary text-left" aria-pressed={answer===index} onClick={()=>setAnswer(index)}>{choice}</button>)}</div>{answer!==null&&<p role="status" className="mt-3">{answer===check.correct?'✓ Верно. Вы уловили основную мысль.':'Посмотрите ещё раз: '+check.choices[check.correct]+'.'}</p>}</details>;
}
