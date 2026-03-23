'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================
// TYPES
// ============================================================
interface Goal {
  id: string;
  name: string;
  time: string; // "HH:MM" 24h
  category: Category;
  icon: string;
}

type Category = 'alimentacion' | 'salud' | 'bienestar' | 'trabajo' | 'otro';

// ============================================================
// CONSTANTS
// ============================================================
const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const CATEGORIES: Record<Category, { label: string; color: string }> = {
  alimentacion: { label: 'Alimentación', color: '#FF9800' },
  salud: { label: 'Salud', color: '#4CAF50' },
  bienestar: { label: 'Bienestar', color: '#2196F3' },
  trabajo: { label: 'Trabajo', color: '#9C27B0' },
  otro: { label: 'Otro', color: '#9E9E9E' },
};

const ICON_OPTIONS = ['🍳', '💊', '🏋️', '🍽️', '🍎', '🍲', '📚', '💼', '🧘', '🚿', '☕', '🥤', '🛌', '🎯', '✍️', '🧹', '🎵', '🚶', '💧', '🦷'];

const DEFAULT_GOALS: Goal[] = [
  { id: '1', name: 'Desayunar', time: '07:00', category: 'alimentacion', icon: '🍳' },
  { id: '2', name: 'Tomar pastilla de la mañana', time: '08:00', category: 'salud', icon: '💊' },
  { id: '3', name: 'Ejercicio', time: '09:00', category: 'bienestar', icon: '🏋️' },
  { id: '4', name: 'Almorzar', time: '12:30', category: 'alimentacion', icon: '🍽️' },
  { id: '5', name: 'Tomar pastilla de la tarde', time: '14:00', category: 'salud', icon: '💊' },
  { id: '6', name: 'Merienda', time: '16:00', category: 'alimentacion', icon: '🍎' },
  { id: '7', name: 'Cenar', time: '19:30', category: 'alimentacion', icon: '🍲' },
  { id: '8', name: 'Tomar pastilla de la noche', time: '21:00', category: 'salud', icon: '💊' },
];

const LS_GOALS = 'metas-diarias-goals';
const LS_COMPLETIONS = 'metas-diarias-completions';

// ============================================================
// HELPERS
// ============================================================
function getCurrentDayIndex(): number {
  const d = new Date().getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;   // Mon=0 … Sun=6
}

function getDateForDayIndex(dayIndex: number): string {
  const today = new Date();
  const cur = getCurrentDayIndex();
  const diff = dayIndex - cur;
  const t = new Date(today);
  t.setDate(today.getDate() + diff);
  return t.toISOString().split('T')[0];
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function isOverdue(goalTime: string, selectedDayIndex: number): boolean {
  const todayIdx = getCurrentDayIndex();
  if (selectedDayIndex !== todayIdx) return false;
  const now = new Date();
  const [h, m] = goalTime.split(':').map(Number);
  const goal = new Date();
  goal.setHours(h, m, 0, 0);
  return now > goal;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// ALARM SOUND (Web Audio API)
// ============================================================
function createAlarmSound() {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function beep() {
    try {
      const ctx = new AudioContext();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(880, ctx.currentTime);
      o1.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
      o1.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      o1.connect(g);
      o1.start(ctx.currentTime);
      o1.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio blocked – visual alarm still shows
    }
  }

  return {
    play() {
      beep();
      intervalId = setInterval(beep, 2500);
    },
    stop() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    },
  };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function MetasDiarias() {
  // ---- state ----
  const [goals, setGoals] = useState<Goal[]>([]);
  const [completions, setCompletions] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedDay, setSelectedDay] = useState(getCurrentDayIndex());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [alarmGoal, setAlarmGoal] = useState<Goal | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [celebration, setCelebration] = useState(false);
  const [mounted, setMounted] = useState(false);

  const alarmRef = useRef(createAlarmSound());
  const triggeredRef = useRef<Set<string>>(new Set());

  // ---- derived ----
  const dateKey = getDateForDayIndex(selectedDay);
  const dayCompletions = completions[dateKey] || {};
  const sortedGoals = [...goals].sort((a, b) => a.time.localeCompare(b.time));
  const completed = sortedGoals.filter((g) => dayCompletions[g.id]).length;
  const total = sortedGoals.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const todayIdx = getCurrentDayIndex();

  // ---- localStorage load ----
  useEffect(() => {
    try {
      const g = localStorage.getItem(LS_GOALS);
      setGoals(g ? JSON.parse(g) : DEFAULT_GOALS);
      const c = localStorage.getItem(LS_COMPLETIONS);
      if (c) setCompletions(JSON.parse(c));
    } catch {
      setGoals(DEFAULT_GOALS);
    }
    setMounted(true);
  }, []);

  // ---- localStorage save ----
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(LS_GOALS, JSON.stringify(goals));
  }, [goals, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(LS_COMPLETIONS, JSON.stringify(completions));
  }, [completions, mounted]);

  // ---- clock tick ----
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---- celebration ----
  useEffect(() => {
    if (total > 0 && completed === total) {
      setCelebration(true);
      const t = setTimeout(() => setCelebration(false), 4000);
      return () => clearTimeout(t);
    }
    setCelebration(false);
  }, [completed, total]);

  // ---- alarm check ----
  useEffect(() => {
    if (!notificationsOn) return;
    const todayDate = getDateForDayIndex(todayIdx);
    const todayComps = completions[todayDate] || {};

    const nowH = currentTime.getHours().toString().padStart(2, '0');
    const nowM = currentTime.getMinutes().toString().padStart(2, '0');
    const nowKey = `${nowH}:${nowM}`;

    for (const goal of goals) {
      if (goal.time !== nowKey) continue;
      if (todayComps[goal.id]) continue;
      const triggerKey = `${todayDate}-${goal.id}`;
      if (triggeredRef.current.has(triggerKey)) continue;

      triggeredRef.current.add(triggerKey);
      setAlarmGoal(goal);
      alarmRef.current.play();

      if (Notification.permission === 'granted') {
        new Notification('Metas Diarias', {
          body: `${goal.icon} ${goal.name} — ${formatTime12h(goal.time)}`,
          icon: '/icon.svg',
          tag: goal.id,
        });
      }
      break; // one alarm at a time
    }
  }, [currentTime, notificationsOn, goals, completions, todayIdx]);

  // ---- service worker registration ----
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ---- handlers ----
  const toggleCompletion = useCallback((goalId: string) => {
    setCompletions((prev) => {
      const day = { ...prev[dateKey] };
      day[goalId] = !day[goalId];
      return { ...prev, [dateKey]: day };
    });
  }, [dateKey]);

  const enableNotifications = useCallback(async () => {
    if (!('Notification' in window)) { alert('Tu navegador no soporta notificaciones'); return; }
    const perm = await Notification.requestPermission();
    setNotificationsOn(perm === 'granted');
  }, []);

  const dismissAlarm = useCallback((markDone: boolean) => {
    alarmRef.current.stop();
    if (markDone && alarmGoal) {
      const todayDate = getDateForDayIndex(todayIdx);
      setCompletions((prev) => {
        const day = { ...prev[todayDate] };
        day[alarmGoal.id] = true;
        return { ...prev, [todayDate]: day };
      });
    }
    setAlarmGoal(null);
  }, [alarmGoal, todayIdx]);

  const saveGoal = useCallback((goal: Goal) => {
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === goal.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = goal;
        return next;
      }
      return [...prev, goal];
    });
    setShowModal(false);
    setEditGoal(null);
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setShowModal(false);
    setEditGoal(null);
  }, []);

  const openAdd = () => { setEditGoal(null); setShowModal(true); };
  const openEdit = (g: Goal) => { setEditGoal(g); setShowModal(true); };

  // ---- don't render until hydrated ----
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="mx-auto max-w-[480px] w-full px-4 pt-6 pb-24 font-sans relative">
      {/* ---- Header ---- */}
      <header className="text-center mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
          <span className="text-3xl">🎯</span> Metas Diarias
        </h1>
        <p className="font-mono text-sm text-text-secondary mt-1 tabular-nums tracking-wider">
          {currentTime.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}
          {currentTime.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </p>
      </header>

      {/* ---- Day Selector ---- */}
      <nav className="flex gap-1.5 justify-center mb-6 animate-fade-in">
        {DAY_LABELS.map((label, i) => {
          const isSelected = i === selectedDay;
          const isToday = i === todayIdx;
          return (
            <button
              key={label}
              onClick={() => setSelectedDay(i)}
              className="relative px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: isSelected ? '#FF9800' : 'rgba(255,255,255,0.05)',
                color: isSelected ? '#0f0f12' : isToday ? '#FF9800' : '#8a8a9a',
                border: isToday && !isSelected ? '1.5px solid #FF9800' : '1.5px solid transparent',
              }}
            >
              {label}
              {isToday && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ background: isSelected ? '#0f0f12' : '#FF9800' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ---- Progress Bar ---- */}
      <div className="mb-5 animate-fade-in">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-text-secondary font-medium">Progreso del día</span>
          <span className="font-mono font-bold" style={{ color: progress === 100 ? '#4CAF50' : '#FF9800' }}>
            {completed}/{total} ({progress}%)
          </span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${progress === 100 ? 'progress-fill-complete' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ---- Celebration ---- */}
      {celebration && (
        <div className="text-center mb-4 p-4 rounded-2xl animate-scale-in" style={{ background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)' }}>
          <p className="text-lg font-bold animate-celebration">🎉 ¡Felicidades!</p>
          <p className="text-sm text-text-secondary mt-1">Completaste todas tus metas del día</p>
        </div>
      )}

      {/* ---- Goals List ---- */}
      <div className="flex flex-col gap-2.5" key={dateKey}>
        {sortedGoals.map((goal) => {
          const done = !!dayCompletions[goal.id];
          const overdue = !done && isOverdue(goal.time, selectedDay);
          const cat = CATEGORIES[goal.category];

          return (
            <div
              key={goal.id}
              className={`goal-card group relative flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 cursor-pointer ${overdue ? 'overdue-glow' : ''}`}
              style={{
                background: done ? 'rgba(76,175,80,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? 'rgba(76,175,80,0.15)' : overdue ? 'rgba(244,67,54,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}
              onClick={() => openEdit(goal)}
            >
              {/* Category indicator */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full" style={{ background: cat.color }} />

              {/* Icon */}
              <span className="text-2xl pl-1.5 select-none" style={{ opacity: done ? 0.5 : 1 }}>{goal.icon}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight truncate ${done ? 'line-through opacity-50' : ''}`}>
                  {goal.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-text-secondary">{formatTime12h(goal.time)}</span>
                  <span className="cat-dot" style={{ background: cat.color }} />
                  <span className="text-[10px] text-text-secondary">{cat.label}</span>
                  {overdue && (
                    <span className="text-[10px] font-bold animate-shake" style={{ color: '#f44336' }}>
                      ¡Pendiente!
                    </span>
                  )}
                </div>
              </div>

              {/* Checkbox */}
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => { e.stopPropagation(); toggleCompletion(goal.id); }}
                onClick={(e) => e.stopPropagation()}
                className="custom-check"
              />
            </div>
          );
        })}
      </div>

      {sortedGoals.length === 0 && (
        <div className="text-center py-12 text-text-secondary animate-fade-in">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">No hay metas configuradas</p>
          <p className="text-xs mt-1">Agrega una meta para comenzar</p>
        </div>
      )}

      {/* ---- Bottom Buttons ---- */}
      <div className="flex gap-3 mt-6 animate-fade-in">
        <button
          onClick={openAdd}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-95"
          style={{ background: '#FF9800', color: '#0f0f12' }}
        >
          <span className="text-lg">+</span> Agregar Meta
        </button>
        <button
          onClick={enableNotifications}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-95"
          style={{
            background: notificationsOn ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.08)',
            color: notificationsOn ? '#4CAF50' : '#8a8a9a',
            border: notificationsOn ? '1px solid rgba(76,175,80,0.3)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {notificationsOn ? '🔔' : '🔕'}
        </button>
      </div>

      {/* ---- Alarm Overlay ---- */}
      {alarmGoal && (
        <div className="alarm-overlay">
          <div className="text-center animate-scale-in">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 animate-alarm"
              style={{ background: 'rgba(255,152,0,0.15)', border: '2px solid #FF9800' }}
            >
              {alarmGoal.icon}
            </div>
            <h2 className="text-xl font-bold mb-1">{alarmGoal.name}</h2>
            <p className="font-mono text-accent text-lg mb-8">{formatTime12h(alarmGoal.time)}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => dismissAlarm(true)}
                className="px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
                style={{ background: '#4CAF50', color: '#fff' }}
              >
                ✓ Completado
              </button>
              <button
                onClick={() => dismissAlarm(false)}
                className="px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#8a8a9a' }}
              >
                Después
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Add/Edit Modal ---- */}
      {showModal && (
        <GoalModal
          initial={editGoal}
          onSave={saveGoal}
          onDelete={editGoal ? () => deleteGoal(editGoal.id) : undefined}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// GOAL MODAL COMPONENT
// ============================================================
function GoalModal({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Goal | null;
  onSave: (g: Goal) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [time, setTime] = useState(initial?.time || '12:00');
  const [category, setCategory] = useState<Category>(initial?.category || 'otro');
  const [icon, setIcon] = useState(initial?.icon || '🎯');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || generateId(),
      name: name.trim(),
      time,
      category,
      icon,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-5">{initial ? 'Editar Meta' : 'Nueva Meta'}</h2>

        {/* Name */}
        <label className="block mb-4">
          <span className="text-xs text-text-secondary font-medium block mb-1.5">Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Meditar 10 min"
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            autoFocus
          />
        </label>

        {/* Time */}
        <label className="block mb-4">
          <span className="text-xs text-text-secondary font-medium block mb-1.5">Hora</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-mono font-medium outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5', colorScheme: 'dark' }}
          />
        </label>

        {/* Category */}
        <label className="block mb-4">
          <span className="text-xs text-text-secondary font-medium block mb-1.5">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CATEGORIES) as [Category, { label: string; color: string }][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: category === key ? val.color : 'rgba(255,255,255,0.06)',
                  color: category === key ? '#0f0f12' : '#8a8a9a',
                  border: `1px solid ${category === key ? val.color : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {val.label}
              </button>
            ))}
          </div>
        </label>

        {/* Icon */}
        <label className="block mb-6">
          <span className="text-xs text-text-secondary font-medium block mb-1.5">Ícono</span>
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className="w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all"
                style={{
                  background: icon === ic ? 'rgba(255,152,0,0.2)' : 'rgba(255,255,255,0.04)',
                  border: icon === ic ? '1.5px solid #FF9800' : '1.5px solid transparent',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-30"
            style={{ background: '#FF9800', color: '#0f0f12' }}
          >
            {initial ? 'Guardar' : 'Agregar'}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'rgba(244,67,54,0.15)', color: '#f44336' }}
            >
              Eliminar
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#8a8a9a' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
