// Анализ осанки по ключевым точкам тела (MediaPipe Pose Landmarker)

export const POSTURE_METRICS = [
  { key: 'drop', label: 'Опущенная голова', ok: 25, warn: 40, unit: '%', hint: 'Поднимите голову и расправьте плечи — не заваливайте голову вперёд' },
  { key: 'neck', label: 'Наклон шеи', ok: 12, warn: 20, unit: '°', hint: 'Голова прямо над плечами, не вытягивайте её вбок' },
  { key: 'back', label: 'Наклон корпуса', ok: 8, warn: 15, unit: '°', hint: 'Выпрямите спину, обопритесь на спинку стула' },
  { key: 'head', label: 'Наклон головы (линия глаз)', ok: 6, warn: 10, unit: '°', hint: 'Не наклоняйте голову набок' },
  { key: 'shoulders', label: 'Перекос плеч', ok: 5, warn: 9, unit: '°', hint: 'Расслабьте и выровняйте плечи' },
];

// вертикальное расстояние ухо—плечо / ширина плеч при прямой осанке
const IDEAL_NECK_RATIO = 0.7;

const degFromHorizontal = (a, b) =>
  Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * (180 / Math.PI);

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const inFrame = (p) => p && (p.visibility == null || p.visibility > 0.6) && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;

const classify = (value, metric) => {
  if (value == null) return 'none';
  if (value <= metric.ok) return 'ok';
  if (value <= metric.warn) return 'warn';
  return 'bad';
};

/**
 * Принимает массив ключевых точек тела (нормализованные координаты 0..1).
 * Каждый показатель рассчитывается по тем точкам, что реально видны в кадре,
 * поэтому работает даже если видна только верхняя часть тела.
 * Возвращает { values, statuses, overall, issues } или null, если точек нет.
 */
export function analyzePose(points, aspect = 1) {
  const lm = points.map(p => ({ ...p, x: p.x * aspect }));
  const visible = (...idx) => idx.every(i => inFrame(points[i]));
  const has = visible;

  const eyes = has(2, 5);
  const ears = has(7, 8);
  const shoulders = has(11, 12);
  const hips = has(23, 24);

  const shoulderMid = shoulders ? mid(lm[11], lm[12]) : null;
  const earMid = ears ? mid(lm[7], lm[8]) : null;
  const hipMid = hips ? mid(lm[23], lm[24]) : null;

  const values = {};
  const statuses = {};
  const issues = [];
  const reasons = [];
  let computed = 0;

  for (const m of POSTURE_METRICS) {
    let value = null;

    if (m.key === 'drop' && shoulderMid && earMid && shoulders) {
      // при сутулости голова уходит вперёд-вниз: расстояние ухо—плечо сжимается
      const shoulderWidth = Math.hypot(lm[11].x - lm[12].x, lm[11].y - lm[12].y);
      const neckLen = Math.abs(shoulderMid.y - earMid.y);
      const ratio = shoulderWidth > 0 ? neckLen / shoulderWidth : 0;
      value = Math.max(0, (1 - ratio / IDEAL_NECK_RATIO)) * 100;
    }
    if (m.key === 'neck' && shoulderMid && earMid) value = 90 - degFromHorizontal(shoulderMid, earMid);
    if (m.key === 'back' && shoulderMid && hipMid) value = 90 - degFromHorizontal(shoulderMid, hipMid);
    if (m.key === 'head' && eyes) value = degFromHorizontal(lm[2], lm[5]);
    if (m.key === 'shoulders' && shoulders) value = degFromHorizontal(lm[11], lm[12]);

    if (value != null) {
      computed++;
      values[m.key] = value;
      statuses[m.key] = classify(value, m);
      if (statuses[m.key] === 'bad' || statuses[m.key] === 'warn') {
        reasons.push(`${m.label} — ${Math.round(value)}${m.unit} (норма до ${m.ok}${m.unit})`);
      }
      if (statuses[m.key] === 'bad') issues.push(m.hint);
    } else {
      statuses[m.key] = 'none';
    }
  }

  if (!computed) return null;

  const list = Object.values(statuses);
  const overall = list.includes('bad') ? 'bad' : list.includes('warn') ? 'warn' : 'ok';

  return { values, statuses, overall, issues, reasons };
}