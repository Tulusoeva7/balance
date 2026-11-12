export function mergeDiaryArea(savedZones,id,detail){
 if(!id||!Number.isInteger(detail?.intensity)||detail.intensity<0||detail.intensity>5)throw new Error('Укажите интенсивность дискомфорта от 0 до 5.');
 if(!['no','yes','unsure'].includes(detail.safety))throw new Error('Ответьте на уточнение об ощущениях и травме.');
 return {...savedZones,[id]:{...detail}};
}
