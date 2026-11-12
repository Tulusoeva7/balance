export const DEVICE_OPTIONS = [
  ['laptop', 'Ноутбук'], ['desktop', 'Стационарный компьютер'],
  ['tablet', 'Планшет'], ['phone', 'Смартфон'],
];
export const primaryDevice = (answers) => answers.device === 'multiple'
  ? answers.primary_device : answers.device === 'monitor' ? 'desktop' : answers.device;
export const hasPortableDevice = (answers) => ['laptop', 'tablet', 'phone'].includes(primaryDevice(answers));
export const usesLaptopScreen = (answers) => primaryDevice(answers) === 'laptop' && answers.main_screen === 'built_in';
export const hasSeparateScreen = (answers) => primaryDevice(answers) === 'desktop' || answers.main_screen === 'external';

export const WORKPLACE_FIELDS = [
  { key: 'device', type: 'single', noUnknown: true,
    label: 'Какими устройствами вы обычно пользуетесь для работы или учёбы?',
    hint: 'Если регулярно переключаетесь между устройствами, выберите «Несколько устройств».',
    options: [...DEVICE_OPTIONS, ['multiple', 'Несколько устройств']] },
  { key: 'primary_device', type: 'single', noUnknown: true, showIf: a => a.device === 'multiple',
    label: 'За каким устройством вы проводите больше всего времени?',
    hint: 'Следующие вопросы относятся к этому основному рабочему месту.', options: DEVICE_OPTIONS },
  { key: 'main_screen', type: 'single', noUnknown: true, showIf: hasPortableDevice,
    label: 'На какой экран вы обычно смотрите?',
    options: [['built_in', 'Экран самого устройства'], ['external', 'Отдельный монитор']] },
  { key: 'ext_kbd', type: 'single', showIf: hasPortableDevice,
    label: 'Используете ли вы отдельную клавиатуру?', options: [['yes', 'Да'], ['no', 'Нет']] },
  { key: 'ext_mouse', type: 'single', showIf: hasPortableDevice,
    label: 'Используете ли вы отдельную мышь?', options: [['yes', 'Да'], ['no', 'Нет']] },
  { key: 'chair_type', type: 'single', label: 'На чём вы обычно сидите во время работы?',
    options: [['office_chair', 'Офисное кресло'], ['regular_chair', 'Обычный стул'], ['sofa', 'Диван или кресло'], ['stool', 'Табурет'], ['standing', 'Работаю стоя']] },
  { key: 'monitor_height', type: 'single', showIf: hasSeparateScreen, label: 'Как расположен отдельный монитор?',
    hint: 'Ориентируйтесь на верхний край экрана относительно уровня глаз.',
    options: [['eye_level', 'Примерно на уровне глаз'], ['too_low', 'Ниже уровня глаз'], ['too_high', 'Выше уровня глаз']] },
  { key: 'screen_position', type: 'single', showIf: a => hasPortableDevice(a) && a.main_screen === 'built_in',
    label: 'Где обычно находится экран устройства?',
    options: [['desk', 'На столе или подставке'], ['lap', 'На коленях'], ['hands', 'Держу в руках']] },
  { key: 'armrests', type: 'single', showIf: a => a.chair_type && a.chair_type !== 'standing',
    label: 'Есть ли подлокотники?', options: [['yes', 'Да'], ['no', 'Нет']] },
  { key: 'laptop_stand', type: 'single', showIf: usesLaptopScreen,
    label: 'Есть ли подставка для ноутбука?', options: [['yes', 'Да'], ['no', 'Нет']] },
];
