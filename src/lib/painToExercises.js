// Связь отмеченных областей самочувствия (BodyMap) с областями библиотеки упражнений
export const PAIN_TO_EXERCISE_ZONES = {
  head: ['neck'],
  neck: ['neck'],
  shoulders: ['posture', 'neck'],
  chest: ['back', 'posture'],
  back: ['back'], // Старые записи
  upper_back: ['back'],
  lower_back: ['lower_back'],
  arms: ['neck', 'posture'],
  hips: ['lower_back', 'full_body'],
  knees: ['full_body', 'feet'],
  feet: ['feet'],
};

export const painZoneLabels = {
  head: 'Голова',
  neck: 'Шея',
  shoulders: 'Плечи',
  chest: 'Грудь',
  back: 'Спина',
  upper_back: 'Верх спины',
  elbows: 'Локти / предплечья',
  wrists: 'Кисти / запястья',
  lower_back: 'Поясница',
  arms: 'Руки',
  hips: 'Бёдра',
  knees: 'Колени',
  feet: 'Стопы',
};