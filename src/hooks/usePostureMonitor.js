import { useState, useRef, useEffect, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { analyzePose } from '@/lib/posture';

// Keep the WASM runtime aligned with the exact tasks-vision version in package.json.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const BAD_HOLD_MS = 5000;        // сколько подряд секунд плохой позы до оповещения
const WARN_HOLD_MS = 15000;      // длительное «внимание» тоже заслуживает напоминания
const ALERT_COOLDOWN_MS = 20000; // пауза между оповещениями

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.12;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 300);
  } catch { /* звук недоступен */ }
}

function notifyDevice(result) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const reasons = result.reasons?.length ? result.reasons : ['Осанка требует внимания'];
    const advice = result.issues?.length ? result.issues[0] : 'Сядьте прямо, расправьте плечи';
    new Notification('Balance — исправьте осанку', {
      body: `${reasons.join('\n')}\n${advice}`,
      tag: 'posture-alert',
    });
  } catch { // уведомления недоступны
  }
}

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  /** @type {import("@mediapipe/tasks-vision").PoseLandmarkerOptions} */
  const options = {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  };
  try {
    return await PoseLandmarker.createFromOptions(vision, options);
  } catch {
    options.baseOptions.delegate = 'CPU';
    return await PoseLandmarker.createFromOptions(vision, options);
  }
}

/** @param {{onAlert?: Function,onSample?: Function,sound?:boolean,notifications?:boolean}} options */
export function usePostureMonitor({ onAlert, onSample, sound=false, notifications=false } = {}) {
  const configRef=useRef({sound,notifications});
  useEffect(()=>{configRef.current={sound,notifications};},[sound,notifications]);
  const onAlertRef = useRef(onAlert);
  const onSampleRef = useRef(onSample);
  const aliveRef = useRef(true);
  const generationRef = useRef(0);
  useEffect(() => { onSampleRef.current = onSample; });
  useEffect(() => { onAlertRef.current = onAlert; });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const intervalRef = useRef(null);
  const badSinceRef = useRef(null);
  const lastAlertRef = useRef(0);
  const lastPushRef = useRef(0);
  const startedAtRef = useRef(null);
  const needsRecoveryRef = useRef(false);
  const goodSinceRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alert, setAlert] = useState(false);
  const [alertIssues, setAlertIssues] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recovered, setRecovered] = useState(false);

  const drawOverlay = (pose, result, video) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pose || !result) return;

    const color = { ok: '#10b981', warn: '#f59e0b', bad: '#ef4444' }[result.overall];
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const line = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    };
    line(pose[2], pose[5]);                          // линия глаз
    line(pose[11], pose[12]);                        // плечи
    line(mid(pose[11], pose[12]), mid(pose[7], pose[8]));   // шея
    line(mid(pose[11], pose[12]), mid(pose[23], pose[24])); // корпус
  };

  const loop = useCallback(() => {
    const step = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || !streamRef.current) return false;
      if (video.readyState >= 2) {
        try {
          const now = performance.now();
          const res = landmarker.detectForVideo(video, now);
          const pose = res.landmarks?.[0];
          const result = pose ? analyzePose(pose, video.videoWidth / video.videoHeight) : null;
          drawOverlay(pose, result, video);

          if (now - lastPushRef.current > 300) {
            lastPushRef.current = now;
            setMetrics(result);
            if (result) onSampleRef.current?.(result);
          }

          if (result && (result.overall === 'bad' || result.overall === 'warn')) {
            const holdMs = result.overall === 'bad' ? BAD_HOLD_MS : WARN_HOLD_MS;
            if (!badSinceRef.current) badSinceRef.current = now;
            if (now - badSinceRef.current > holdMs && now - lastAlertRef.current > ALERT_COOLDOWN_MS) {
              lastAlertRef.current = now;
              setAlertCount(c => c + 1);
              setAlertIssues(result.issues);
              setAlert(true);
              needsRecoveryRef.current = true;
              goodSinceRef.current = null;
              if(configRef.current.sound) beep();
              if(configRef.current.notifications) notifyDevice(result);
              onAlertRef.current?.(result);
              setTimeout(() => setAlert(false), 6000);
            }
          } else {
            badSinceRef.current = null;
            if (result?.overall === 'ok' && needsRecoveryRef.current) {
              if (!goodSinceRef.current) goodSinceRef.current = now;
              if (now - goodSinceRef.current > 2500) {
                needsRecoveryRef.current = false; goodSinceRef.current = null; setRecovered(true);
                setTimeout(() => setRecovered(false), 6000);
              }
            } else if (result?.overall !== 'ok') goodSinceRef.current = null;
          }
        } catch { // пропуск проблемного кадра
        }
      }
      return true;
    };
    const tick = () => {
      if (step()) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // requestAnimationFrame замирает в свёрнутой вкладке — продолжаем анализ по таймеру
    intervalRef.current = setInterval(() => {
      if (document.hidden) step();
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    badSinceRef.current = null;
    setRunning(false);
    setMetrics(null);
    setAlert(false);
    setRecovered(false); needsRecoveryRef.current=false; goodSinceRef.current=null;
    setElapsed(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    const generation = ++generationRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      if (!aliveRef.current || generation !== generationRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (!landmarkerRef.current) {
        landmarkerRef.current = await createLandmarker();
      }
      if (!aliveRef.current || generation !== generationRef.current) { stream.getTracks().forEach(t => t.stop()); landmarkerRef.current?.close();landmarkerRef.current=null; return; }
      setAlertCount(0);
      badSinceRef.current = null;
      lastAlertRef.current = 0;
      lastPushRef.current = 0;
      startedAtRef.current = Date.now();
      setRunning(true);
      loop();
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setError('Не удалось включить камеру. Разрешите доступ к камере в браузере и попробуйте снова.');
    } finally {
      setStarting(false);
    }
  }, [loop]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => () => {
    aliveRef.current = false;
    generationRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (landmarkerRef.current) landmarkerRef.current.close();
  }, []);

  return { running, starting, error, metrics, alert, alertIssues, alertCount, recovered, elapsed, start, stop, videoRef, canvasRef };
}
