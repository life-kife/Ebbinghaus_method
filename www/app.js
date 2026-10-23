(() => {
'use strict';
const KEY = 'ebb-cards-v1';                 // ключ хранилища не меняем, иначе пропадут карточки
const DATA_VERSION = 3;
const DAY = 86400000;
const REMIND_DAYS = 30, REMIND_ID_BASE = 1000;
const MAX_PHOTOS = 6;
const PALETTE = 8;
const C = window.CONTENT, S = window.SCHED, TH = window.THEME;
const DECK_TYPES = { facts: { name: 'Слова и факты', limit: 15 }, deep: { name: 'Глубокие вопросы', limit: 7 }, custom: { name: 'Своё число' } };

const OLD_SAMPLES = {
  'Какой регистр 8086 — счётчик для команды LOOP?': 'CX',
  'Физический адрес при сегменте 1000h и смещении 0020h?': '10020h\n(сегмент × 16 + смещение)',
  'Какая функция INT 21h выводит строку на экран?': 'AH = 09h, строка заканчивается символом «$»',
  'Что делает команда XLAT?': 'AL ← [BX + AL]\nподстановка из таблицы',
  'Чем exec() отличается от fork()?': 'fork создаёт копию процесса,\nexec заменяет текущий процесс новой программой',
  'Что означают права 750?': 'Владелец rwx, группа r-x, остальные ---',
  'Как посмотреть дерево процессов?': 'pstree\n(или ps -ef --forest)',
  'Что показывает диаграмма прецедентов (use case)?': 'Кто пользуется системой (актёры) и какие задачи в ней решает',
  'Чем IDEF0 отличается от DFD?': 'IDEF0 описывает функции и управление, DFD — потоки данных между процессами и хранилищами',
};

// ---------- Утилиты ----------
const realToday = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
const dateOf = n => new Date(n * DAY);
const fmt = n => dateOf(n).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtS = n => dateOf(n).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
const fmtY = n => { const y = dateOf(n).getUTCFullYear(); return y === dateOf(today()).getUTCFullYear() ? fmt(n) : fmt(n) + ' ' + y; };
const fmtLong = n => dateOf(n).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const wd = n => dateOf(n).toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
const toISO = n => dateOf(n).toISOString().slice(0, 10);
const fromISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null; };
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const cardsWord = n => n + ' ' + plural(n, 'карточка', 'карточки', 'карточек');
const daysWord = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
function ivWord(n) {
  if (n < 30) return daysWord(n);
  if (n < 365) { const m = Math.round(n / 30); return m + ' ' + plural(m, 'месяц', 'месяца', 'месяцев'); }
  const y = Math.round(n / 365); return y + ' ' + plural(y, 'год', 'года', 'лет');
}
const inDays = n => n <= 0 ? 'сегодня' : n === 1 ? 'завтра' : 'через ' + ivWord(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const lastPick = {};
function pick(list, key) {
  if (list.length < 2) return list[0];
  let i; do { i = Math.floor(Math.random() * list.length); } while (i === lastPick[key]);
  lastPick[key] = i; return list[i];
}
const ICON = {
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 5.6 5 10.3A5 5 0 0 1 12 17.5 5 5 0 0 1 7 12.6c0-2 1-3.5 2-4.6.2 1.6 1 2.6 2 3 0-3 .3-6.2 1-9zm0 22a7 7 0 0 1-7-7h2a5 5 0 0 0 10 0h2a7 7 0 0 1-7 7z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v4.5h15V15"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 15v4.5h15V15"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9.5 3.5h5M10.5 3.5v5.5L5 18.5A1.5 1.5 0 0 0 6.3 20.5h11.4a1.5 1.5 0 0 0 1.3-2L13.5 9V3.5"/><path d="M7.5 15h9"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.8 1.8-1.8h2.1a4 4 0 0 0 4-4C20.5 6.7 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.6" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/></svg>',
  decks: '<svg viewBox="0 0 24 24"><rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 0 1 2.5 2.5V16"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.3"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/></svg>',
};

// ---------- Состояние ----------
let state, ver = 0;
const today = () => realToday() + state.offset;
function load() {
  try { const r = localStorage.getItem(KEY); if (r) state = JSON.parse(r); } catch (e) {}
  if (!state) state = { offset: 0, cards: [], v: DATA_VERSION };
  state.settings = Object.assign({ remind: true, time: '19:00' }, state.settings || {});
  state.theme = Object.assign({ pal: 'A', mode: 'system' }, state.theme || {});
  state.log = state.log || {};
  state.hist = state.hist || [];
  state.colors = state.colors || {};
  state.deckCfg = state.deckCfg || {};
  if (state.onboarded === undefined) state.onboarded = (state.cards || []).length > 0;
  if (!state.v || state.v < 2) state.cards = state.cards.filter(c => OLD_SAMPLES[c.q] !== c.a);
  for (const c of state.cards) {
    c.qPh = c.qPh || []; c.aPh = c.aPh || [];
    if (!c.mode) c.mode = 'smart';
    if (c.fresh === undefined) c.fresh = c.reps === 0 && c.interval === 0;
    if (c.nom === undefined) c.nom = c.due;
    if (c.step === undefined) c.step = 0;
  }
  state.v = DATA_VERSION;
  assignColors(); save(true);
}
function save(quiet) { assignColors(); ver++; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { if (!quiet) toast('Не удалось сохранить: память переполнена'); } }

// ---------- Колоды ----------
const decks = () => [...new Set(state.cards.map(c => c.deck))].sort((a, b) => a.localeCompare(b, 'ru'));
const activeDecks = () => [...new Set(state.cards.filter(c => !c.archived).map(c => c.deck))].sort((a, b) => a.localeCompare(b, 'ru'));
function assignColors() {
  const used = new Set(Object.values(state.colors));
  for (const d of decks()) {
    if (state.colors[d] !== undefined) continue;
    let i = 0; while (used.has(i) && i < PALETTE) i++;
    if (i >= PALETTE) i = Object.keys(state.colors).length % PALETTE;
    state.colors[d] = i; used.add(i);
  }
}
const deckColor = d => `var(--c${(state.colors[d] ?? 7) % PALETTE})`;
const cfg = d => Object.assign({ type: 'facts', limit: 15, mode: 'smart' }, state.deckCfg[d] || {});
const limitOf = d => Math.max(1, cfg(d).limit | 0);

// ---------- Расписание: прогноз (кэш) ----------
let fcCache = { key: '', fc: null };
function fc(until) {
  const u = Math.max(until || 0, today() + 60);
  const key = ver + ':' + today() + ':' + u;
  if (fcCache.key !== key) fcCache = { key, fc: S.forecast(state.cards, limitOf, today(), u, state.hist) };
  return fcCache.fc;
}
const todayQ = deck => (fc().days.get(today()) || []).map(x => x.c).filter(c => !deck || c.deck === deck);
const overflowNow = deck => state.cards.filter(c => !c.archived && c.due <= today() && (!deck || c.deck === deck)).length - todayQ(deck).length;
const doneToday = () => state.log[today()] || 0;
function streak() { let d = today(), n = 0; if (!state.log[d]) d--; while (state.log[d]) { n++; d--; } return n; }
function backlogWarnings() {
  const be = fc().backlogEnd, t = today();
  return Object.entries(be).filter(([, d]) => d - t >= 3).map(([deck, d]) => ({ deck, d }));
}

// ---------- Карточки: создание и повторение ----------
function newCard(q, a, deck, opts = {}) {
  const c = { id: uid(), q, a, deck, due: today(), nom: today(), interval: 0, ease: 2.5, reps: 0, step: 0, fresh: true,
    mode: opts.mode || cfg(deck).mode, qPh: opts.qPh || [], aPh: opts.aPh || [] };
  if (c.mode === 'plan') c.plan = opts.plan || { kind: 'classic' };
  setStart(c, opts.start ?? today());
  return c;
}
// Старт: будущая дата — ждёт до этого дня; прошедшая — «выучил тогда»
function setStart(c, start) {
  const t = today();
  c.start = start;
  if (c.mode === 'plan' && c.plan && c.plan.kind === 'exam') c.plan.dates = S.examDates(start, c.plan.exam);
  if (start >= t) { c.fresh = true; c.due = c.nom = start; c.step = 0; c.reps = 0; c.interval = 0; c.last = null; return; }
  c.fresh = false; c.last = start;
  if (c.mode === 'plan') { const n = S.planNext({ ...c, step: 0 }, start); if (n.finished) { c.due = c.nom = t; c.step = 1; c.interval = 0; } else { c.due = c.nom = n.due; c.step = n.step; c.interval = n.interval; } }
  else { c.reps = 1; c.interval = 1; c.due = c.nom = start + 1; }
}
function previewSm2(c, q) { return S.sm2(c, q).interval; }
function applySmart(c, q) {
  const r = S.sm2(c, q), T = today();
  Object.assign(c, r); c.fresh = false; c.last = T; c.pin = false;
  if (q < 3) { c.due = c.nom = T; return; }
  c.nom = T + r.interval;
  c.due = S.pickDay(c.nom, r.interval, 'smart', c.deck, state.cards, T, c.id);
}
function applyPlan(c) {
  const T = today(), n = S.planNext(c, T);
  c.fresh = false; c.last = T; c.pin = false;
  if (n.finished) { c.archived = true; c.step++; return 'finished'; }
  if (n.switchToClassic) c.plan = { kind: 'classic' };
  c.step = n.step; c.interval = n.interval; c.nom = n.due;
  c.due = S.pickDay(n.due, n.interval, 'plan', c.deck, state.cards, T, c.id);
}
function planPreviewDates(c, count = 8) {     // ближайшие даты плана для показа
  const sim = { ...c, plan: { ...c.plan } };
  const out = [sim.due];
  return out.concat(S.chain(sim, today() + 365 * 60, count));
}
const gradeOf = q => q === 'p' ? { name: 'Повторил', cls: 'g-good' } : q === 1 ? { name: 'Не помню', cls: 'g-again' } : q === 3 ? { name: 'С трудом', cls: 'g-hard' } : { name: 'Помню', cls: 'g-good' };
function rebalanceAll() { const m = S.rebalance(state.cards, limitOf, today()); if (m) ver++; return m; }

// ---------- Фото: IndexedDB ----------
let dbp = null;
function idb() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('ebb-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('p', mode), req = fn(t.objectStore('p'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
  });
}
const photoPut = (id, val) => tx('readwrite', st => st.put(val, id));
const photoGet = id => tx('readonly', st => st.get(id));
const photoDel = id => { dropUrl(id); return tx('readwrite', st => st.delete(id)).catch(() => {}); };
const photoClear = () => tx('readwrite', st => st.clear());
const urlCache = new Map();
function dropUrl(id) { for (const k of ['full', 'thumb']) { const u = urlCache.get(id + k); if (u) { URL.revokeObjectURL(u); urlCache.delete(id + k); } } }
async function photoUrl(id, kind) {
  const k = id + kind; if (urlCache.has(k)) return urlCache.get(k);
  const rec = await photoGet(id).catch(() => null); if (!rec) return '';
  const u = URL.createObjectURL(rec[kind] || rec.full); urlCache.set(k, u); return u;
}
function hydrate(root, after) {
  [...(root || document).querySelectorAll('img[data-ph]:not([src])')].forEach(async img => {
    if (after) img.onload = after;
    const u = await photoUrl(img.dataset.ph, img.dataset.kind || 'full');
    if (u) img.src = u; else img.alt = 'фото не найдено';
  });
}
function loadImgEl(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function toCanvasBlob(src, max, quality) {
  const w = src.width, h = src.height, s = Math.min(1, max / Math.max(w, h));
  const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(res, 'image/jpeg', quality));
}
async function processImage(blob) {
  let src;
  try { src = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch (e) { src = await loadImgEl(URL.createObjectURL(blob)); }
  const full = await toCanvasBlob(src, 1400, 0.82), thumb = await toCanvasBlob(src, 240, 0.75);
  const id = 'ph_' + uid(); await photoPut(id, { full, thumb }); return id;
}

// ---------- Нативные возможности ----------
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const plugin = name => isNative ? ((Cap.Plugins && Cap.Plugins[name]) || Cap.registerPlugin(name)) : null;
const LN = plugin('LocalNotifications'), Haptics = plugin('Haptics'), App = plugin('App'), StatusBar = plugin('StatusBar'), Camera = plugin('Camera');
let permission = isNative ? 'unknown' : 'web';
const buzz = style => { try { Haptics && Haptics.impact({ style }); } catch (e) {} };
function applyTheme() {
  TH.apply(state.theme.pal, state.theme.mode, ({ dark, bg }) => {
    if (!StatusBar) return;
    try { StatusBar.setBackgroundColor({ color: bg }); StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch (e) {}
  });
}
async function ensurePermission(ask) {
  if (!LN) return false;
  try { let p = await LN.checkPermissions(); if (p.display !== 'granted' && ask) p = await LN.requestPermissions(); permission = p.display; return p.display === 'granted'; }
  catch (e) { permission = 'error'; return false; }
}
async function scheduleReminders() {
  if (!LN) return;
  try {
    await LN.cancel({ notifications: Array.from({ length: REMIND_DAYS }, (_, i) => ({ id: REMIND_ID_BASE + i })) });
    if (!state.settings.remind || permission !== 'granted') return;
    const [hh, mm] = state.settings.time.split(':').map(Number);
    const now = new Date(), list = [], f = fc(today() + REMIND_DAYS);
    for (let i = 0; i < REMIND_DAYS; i++) {
      const cards = (f.days.get(today() + i) || []).map(x => x.c);
      if (!cards.length) continue;
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh, mm, 0, 0);
      if (at <= now) continue;
      const parts = Object.entries(cards.reduce((m, c) => (m[c.deck] = (m[c.deck] || 0) + 1, m), {})).map(([k, v]) => `${k} · ${v}`).join(', ');
      list.push({ id: REMIND_ID_BASE + i, title: `Пора повторить ${cardsWord(cards.length)}`, body: `${parts}. Около ${Math.max(1, Math.round(cards.length * 0.3))} мин.`,
        schedule: { at, allowWhileIdle: true }, extra: { open: 'review' } });
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.error('schedule', e); }
}
async function testNotification() {
  if (!LN) { toast('Уведомления работают в приложении на телефоне'); return; }
  if (!(await ensurePermission(true))) { toast('Разрешите уведомления в настройках телефона'); render(); return; }
  await LN.schedule({ notifications: [{ id: 1, title: 'Так будет выглядеть напоминание', body: `Сейчас к повторению: ${cardsWord(todayQ().length)}`, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, extra: { open: 'review' } }] });
  toast('Уведомление придёт через 10 секунд. Можно свернуть приложение.');
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }
function changed() { save(); scheduleReminders(); }

// ---------- Навигация ----------
let screen = 'home', session = null, sheet = null, viewer = null, menuOpen = false;
let cardFilter = '', cardQuery = '';
function go(s) { closeSheet(); screen = s; render(); window.scrollTo(0, 0); }
function render() {
  const bare = screen === 'review' || screen === 'onboarding';
  $('nav').hidden = bare;
  $('app').className = 'wrap' + (bare ? ' bare' : '');
  document.querySelectorAll('nav [data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === screen)));
  const n = todayQ().length; $('badge').textContent = n; $('badge').hidden = !n;
  ({ onboarding: renderOnboarding, home: renderHome, review: renderReview, cal: renderCal, cards: renderCards, more: renderMore })[screen]();
}
const warnHtml = () => backlogWarnings().map(w => `<p class="note warn">В колоде «${esc(w.deck)}» карточки не помещаются в лимит, очередь тянется до ${fmtY(w.d)}. Добавляйте новые реже или увеличьте лимит в настройках колоды.</p>`).join('');

// ---------- Знакомство ----------
const ONB = [
  { title: 'Запоминайте надолго', text: 'Без повторения мы забываем больше половины нового уже в первые часы. Карточки напомнят повторить ровно тогда, когда материал начинает забываться.',
    art: `<svg viewBox="0 0 320 220" fill="none"><rect x="20" y="20" width="280" height="180" rx="22" fill="var(--surface)" stroke="var(--line)"/>
      <path d="M50 170H280" stroke="var(--line)" stroke-width="2"/><path d="M50 60 C 70 140, 85 158, 110 162" stroke="var(--again)" stroke-width="5" stroke-linecap="round" opacity=".55" stroke-dasharray="2 9"/>
      <path d="M50 60 C 62 120, 78 132, 100 136 L100 66 C 125 120, 150 130, 175 132 L175 70 C 210 104, 245 112, 280 114" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="50" cy="60" r="8" fill="var(--accent)"/><circle cx="100" cy="66" r="8" fill="var(--good)"/><circle cx="175" cy="70" r="8" fill="var(--good)"/>
      <text x="112" y="160" font-size="13" fill="var(--again)" font-family="Golos Text,sans-serif">без повторений</text><text x="190" y="58" font-size="13" fill="var(--good)" font-family="Golos Text,sans-serif">с повторениями</text></svg>` },
  { title: 'Вспомните, потом проверьте', text: 'Сначала попробуйте ответить сами, затем откройте ответ. В умном режиме оценка меняет расписание, а в режиме «По плану» даты известны заранее.',
    art: `<svg viewBox="0 0 320 220" fill="none"><rect x="40" y="18" width="240" height="120" rx="20" fill="var(--surface)" stroke="var(--line)"/>
      <rect x="80" y="52" width="160" height="12" rx="6" fill="var(--sunken)"/><rect x="100" y="76" width="120" height="12" rx="6" fill="var(--sunken)"/><rect x="118" y="104" width="84" height="10" rx="5" fill="var(--accent-soft)"/>
      <rect x="22" y="156" width="86" height="46" rx="14" fill="var(--again-soft)"/><text x="65" y="184" text-anchor="middle" font-size="14" font-weight="600" fill="var(--again)" font-family="Golos Text,sans-serif">Не помню</text>
      <rect x="117" y="156" width="86" height="46" rx="14" fill="var(--hard-soft)"/><text x="160" y="184" text-anchor="middle" font-size="14" font-weight="600" fill="var(--hard)" font-family="Golos Text,sans-serif">С трудом</text>
      <rect x="212" y="156" width="86" height="46" rx="14" fill="var(--good-soft)"/><text x="255" y="184" text-anchor="middle" font-size="14" font-weight="600" fill="var(--good)" font-family="Golos Text,sans-serif">Помню</text></svg>` },
  { title: 'Мы напомним сами', text: 'Выберите удобное время. В дни, когда есть карточки, придёт уведомление, даже если приложение закрыто.', reminders: true,
    art: `<svg viewBox="0 0 320 220" fill="none"><rect x="30" y="58" width="260" height="104" rx="22" fill="var(--surface)" stroke="var(--line)"/>
      <rect x="50" y="78" width="44" height="44" rx="12" fill="var(--accent)"/><path d="M62 106v-8a10 10 0 0 1 20 0v8l2.5 3.5h-25z M68 114a4 4 0 0 0 8 0" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="108" y="82" width="150" height="12" rx="6" fill="var(--ink)" opacity=".85"/><rect x="108" y="104" width="112" height="10" rx="5" fill="var(--sunken)"/><rect x="108" y="124" width="80" height="10" rx="5" fill="var(--sunken)"/>
      <text x="268" y="148" text-anchor="end" font-size="12" fill="var(--muted)" font-family="Golos Text,sans-serif">19:00</text></svg>` },
];
let onbStep = 0;
function renderOnboarding() {
  const s = ONB[onbStep], last = onbStep === ONB.length - 1;
  $('app').innerHTML = `<div class="onb">
    <button class="link skip" id="skip" ${last ? 'style="visibility:hidden"' : ''}>Пропустить</button>
    <div class="art enter">${s.art}</div>
    <div class="bottom">
      <div class="txt enter"><h1>${s.title}</h1><p class="muted">${s.text}</p></div>
      ${s.reminders ? `<div class="group"><label class="opt" style="color:var(--ink);font-size:1rem"><span class="ic">${ICON.clock}</span><span class="t">Напоминать в<small>можно изменить в настройках</small></span><input type="time" class="tm" id="onbTime" value="${state.settings.time}"></label></div>` : ''}
      <div class="dots">${ONB.map((_, i) => `<i class="${i === onbStep ? 'on' : ''}"></i>`).join('')}</div>
      <button class="primary big" id="next">${last ? 'Разрешить уведомления и начать' : 'Дальше'}</button>
      ${last ? '<button class="link" id="noNotif">Начать без напоминаний</button>' : ''}
    </div></div>`;
  const finish = async remind => {
    state.settings.remind = remind; state.onboarded = true;
    const t = $('onbTime'); if (t && t.value) state.settings.time = t.value;
    save(); if (remind) await ensurePermission(true);
    await scheduleReminders(); go('home');
  };
  $('next').onclick = () => { buzz('LIGHT'); if (last) finish(true); else { onbStep++; renderOnboarding(); } };
  $('skip').onclick = () => { onbStep = ONB.length - 1; renderOnboarding(); };
  const nn = $('noNotif'); if (nn) nn.onclick = () => finish(false);
}

// ---------- Сегодня ----------
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'; }
function ring(done, left) {
  const total = done + left, p = total ? done / total : 1, r = 44, Cc = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--sunken)" stroke-width="10"/>
    <circle cx="52" cy="52" r="${r}" fill="none" stroke="${left ? 'var(--accent)' : 'var(--good)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc * (1 - p)}" style="transition:stroke-dashoffset .6s"/></svg>
    <div class="val">${left ? `<b>${left}</b><span>осталось</span>` : `<b style="color:var(--good)">${ICON.check.replace('<svg', '<svg width="40" height="40"')}</b>`}</div></div>`;
}
const EMPTY_ART = `<svg viewBox="0 0 200 140" fill="none"><rect x="46" y="22" width="112" height="88" rx="16" fill="var(--sunken)" transform="rotate(-8 102 66)"/>
  <rect x="44" y="26" width="112" height="88" rx="16" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
  <rect x="64" y="50" width="72" height="9" rx="4.5" fill="var(--sunken)"/><rect x="74" y="68" width="52" height="9" rx="4.5" fill="var(--sunken)"/>
  <circle cx="150" cy="112" r="20" fill="var(--accent)"/><path d="M150 103v18M141 112h18" stroke="var(--accent-ink)" stroke-width="3.4" stroke-linecap="round"/></svg>`;
function renderHome() {
  const n = todayQ().length, done = doneToday(), st = streak(), t = today(), over = overflowNow();
  const nextDays = [...fc().days.keys()].filter(d => d > t).sort((a, b) => a - b);
  const next = nextDays[0];
  const remindOn = state.settings.remind && permission === 'granted';
  const week = Array.from({ length: 7 }, (_, i) => t - 6 + i);
  const empty = !state.cards.filter(c => !c.archived).length;
  $('app').innerHTML = `
    <header class="top"><div><p class="eyebrow">${state.offset ? 'Тест · ' : ''}${fmt(t)}</p><h1>${greeting()}</h1></div>
      <span class="streak ${st ? 'on' : ''}" title="Дней подряд">${ICON.flame}${st}</span></header>
    ${isNative && state.settings.remind && permission !== 'granted' && permission !== 'unknown' ? `<p class="note warn">Напоминания не придут: нет разрешения на уведомления. <button class="link" id="askPerm">Разрешить</button></p>` : ''}
    ${empty ? `<section class="hero center">
        <div class="empty-art">${EMPTY_ART}</div>
        <div style="display:grid;gap:6px"><h2 style="font:700 1.3rem var(--f-display)">Пока нет ни одной карточки</h2><p class="muted small">${pick(C.emptyTips, 'tip')}</p></div>
        <button class="primary big" id="addFirst">Создать первую карточку</button>
        <button class="link" id="starter">Попробовать на трёх простых примерах</button>
      </section>`
    : `<section class="hero">
      <div class="hero-row">${ring(done, n)}
        <div class="hero-txt">${n
          ? `<h2>${n === 1 ? 'Осталась 1 карточка' : `${plural(n, 'Осталась', 'Осталось', 'Осталось')} ${cardsWord(n)}`}</h2><p class="muted small">Примерно ${Math.max(1, Math.round(n * 0.3))} мин${done ? ` · уже повторено ${done}` : ''}</p>`
          : `<h2>На сегодня всё</h2><p class="muted small">${next !== undefined ? `Следующие карточки ${inDays(next - t)}${remindOn ? `, напомним в ${state.settings.time}` : ''}.` : ''}</p>`}
        ${over > 0 ? `<p class="muted small">Ещё ${cardsWord(over)} сверх лимита перенесены на следующие дни</p>` : ''}
        </div></div>
      ${n ? `<button class="primary big" id="start">Начать повторение</button>` : over > 0 ? `<button class="big" id="extra">Повторить ещё ${over} сверх лимита</button>` : ''}
    </section>
    ${warnHtml()}
    <section class="decks"><h2>Колоды</h2>
      ${activeDecks().map(d => { const k = todayQ(d).length, all = state.cards.filter(c => c.deck === d && !c.archived).length;
        return `<button class="deck" data-deck="${esc(d)}"><i class="dot" style="background:${deckColor(d)};width:12px;height:12px"></i><span class="name">${esc(d)}</span>
          <span class="n ${k ? 'has' : ''}">${k ? `${k} из ${limitOf(d)} сегодня` : cardsWord(all)}</span><span class="chev">›</span></button>`; }).join('')}</section>`}
    <button class="panel" id="weekPanel"><div class="top" style="align-items:center"><h2>Неделя</h2><span class="muted small">${st ? `${daysWord(st)} подряд · ` : ''}календарь ›</span></div>
      <div class="week">${week.map(d => `<div><i class="${state.log[d] ? 'on' : ''} ${d === t ? 'today' : ''}">${state.log[d] || ''}</i>${wd(d)}</div>`).join('')}</div></button>`;
  const s = $('start'); if (s) s.onclick = () => startSession('');
  const ex = $('extra'); if (ex) ex.onclick = () => startSession('', true);
  const a = $('addFirst'); if (a) a.onclick = () => openSheet();
  const sr = $('starter'); if (sr) sr.onclick = () => {
    for (const [q, ans] of C.starter) state.cards.push(newCard(q, ans, 'Пример'));
    changed(); render(); toast('Добавлены 3 примера. Их можно удалить в разделе «Карточки»');
  };
  const p = $('askPerm'); if (p) p.onclick = async () => { await ensurePermission(true); await scheduleReminders(); render(); };
  $('weekPanel').onclick = () => { calSel = today(); calMonth = null; go('cal'); };
  document.querySelectorAll('[data-deck]').forEach(b => b.onclick = () => {
    if (todayQ(b.dataset.deck).length) startSession(b.dataset.deck); else { cardFilter = b.dataset.deck; go('cards'); }
  });
}

// ---------- Повторение ----------
function startSession(deck, extra) {
  session = { deck, extra: !!extra, total: queue(deck, !!extra).length, done: 0, revealed: false, current: null, tally: { 1: 0, 3: 0, 4: 0, p: 0 }, hint: pick(C.frontHints, 'fh') };
  buzz('LIGHT'); go('review');
}
function queue(deck, extra) {
  if (!extra) return todayQ(deck);
  return state.cards.filter(c => !c.archived && c.due <= today() && (!deck || c.deck === deck)).sort(S.prio);
}
const phGrid = ids => !ids || !ids.length ? '' : `<div class="ph-grid ${ids.length === 1 ? 'one' : 'many'}">${ids.map((id, i) => `<img data-ph="${id}" data-kind="${ids.length === 1 ? 'full' : 'thumb'}" data-view="${ids.join(',')}" data-i="${i}" alt="Фото">`).join('')}</div>`;
function renderReview() {
  if (!session) return go('home');
  const fresh = !session.current;
  let c = session.current;
  if (!c) { c = session.current = queue(session.deck, session.extra)[0] || null; if (c) session.hint = pick(C.frontHints, 'fh'); }
  const pct = Math.min(100, Math.round(session.done / Math.max(1, session.total) * 100));
  if (!c) {
    const t = today(), next = [...fc().days.keys()].filter(d => d > t).sort((a, b) => a - b)[0], st = streak(), over = overflowNow(session.deck);
    $('app').innerHTML = `<div class="done enter">
      <div class="badge-big">${ICON.check}</div>
      <div style="display:grid;gap:6px"><h1>${pick(C.doneTitles, 'dt')}</h1><p class="muted">Повторено ${cardsWord(session.done)}${st ? ` · серия ${daysWord(st)}` : ''}</p></div>
      <div class="tally"><div><b style="color:var(--good)">${session.tally[4] + session.tally.p}</b><span>${session.tally.p && !session.tally[4] ? 'по плану' : 'помню'}</span></div><div><b style="color:var(--hard)">${session.tally[3]}</b><span>с трудом</span></div><div><b style="color:var(--again)">${session.tally[1]}</b><span>не помню</span></div></div>
      ${over > 0 ? `<p class="muted small">Ещё ${cardsWord(over)} сверх лимита перенесены на следующие дни.</p><button id="more">Повторить их сейчас</button>` : `<p class="muted small">${next !== undefined ? `Следующее повторение ${inDays(next - t)}.` : ''}</p>`}
      <button class="primary big" id="home">Отлично</button></div>`;
    $('home').onclick = () => { session = null; go('home'); };
    const m = $('more'); if (m) m.onclick = () => startSession(session.deck, true);
    buzz('MEDIUM');
    return;
  }
  const col = deckColor(c.deck);
  $('app').innerHTML = `
    <div class="topbar"><button class="link" id="back" aria-label="Выйти">✕</button><div class="bar"><i style="width:${pct}%"></i></div><span class="muted small" style="font-variant-numeric:tabular-nums">${session.done}/${session.total}</span></div>
    <div class="stage ${fresh ? 'enter' : ''}"><div class="flip ${session.revealed ? 'turned' : ''}" id="flip">
      <article class="face front"><span class="tag"><i class="dot" style="background:${col}"></i>${esc(c.deck)}${c.mode === 'plan' ? ' · по плану' : ''}</span><div class="q">${esc(c.q)}</div>${phGrid(c.qPh)}<p class="hint">${session.hint}</p></article>
      <article class="face back"><span class="tag"><i class="dot" style="background:${col}"></i>${esc(c.deck)}</span><div class="qsmall">${esc(c.q)}</div><div class="a">${esc(c.a)}</div>${phGrid(c.aPh)}</article>
    </div></div>
    <div id="actions">${actions(c)}</div>`;
  fitFlip(); hydrate($('flip'), fitFlip); bindViewer($('flip'));
  $('back').onclick = () => { session = null; go('home'); };
  $('flip').onclick = reveal;
  bindActions();
}
function actions(c) {
  if (!session.revealed) return `<button class="primary big" id="show">Показать ответ</button>`;
  if (c.mode === 'plan') {
    const n = S.planNext(c, today());
    const nx = n.finished ? (c.plan.after === 'stop' || c.plan.kind === 'exam' ? 'план к экзамену завершён' : '') : `следующее ${inDays(n.due - today())}, ${fmtY(n.due)}`;
    return `<button class="primary big" id="planDone">Повторил</button><p class="muted small center">${nx}</p>`;
  }
  return `<div class="grades">${[[1, 'Не помню', 'g-again'], [3, 'С трудом', 'g-hard'], [4, 'Помню', 'g-good']].map(([q, name, cls]) => { const n = previewSm2(c, q);
    return `<button class="grade ${cls}" data-q="${q}">${name}<small>${n === 0 ? 'ещё раз' : inDays(n)}</small></button>`; }).join('')}</div>`;
}
function bindActions() {
  const s = $('show'); if (s) s.onclick = reveal;
  const p = $('planDone'); if (p) p.onclick = () => grade('p');
  document.querySelectorAll('.grade').forEach(b => b.onclick = () => grade(+b.dataset.q));
}
function fitFlip() {
  const f = $('flip'); if (!f) return;
  const h = Math.max(...[...f.children].map(el => { el.style.position = 'relative'; const v = el.offsetHeight; el.style.position = ''; return v; }));
  f.style.minHeight = Math.max(300, h) + 'px';
}
function reveal() {
  if (!session || session.revealed) return;
  session.revealed = true; buzz('LIGHT');
  $('flip').classList.add('turned');
  $('actions').innerHTML = actions(session.current); bindActions();
}
function grade(q) {
  const card = state.cards.find(c => c.id === session.current.id);
  let res;
  if (q === 'p') res = applyPlan(card); else applySmart(card, q);
  if (q === 1) session.total++;
  state.log[today()] = (state.log[today()] || 0) + 1;
  state.hist.push({ d: today(), id: card.id, g: q, k: card.deck, q: card.q.slice(0, 120) });
  if (state.hist.length > 20000) state.hist.splice(0, state.hist.length - 20000);
  session.tally[q]++; session.done++; session.current = null; session.revealed = false;
  buzz(q === 1 ? 'MEDIUM' : 'LIGHT');
  if (res === 'finished') toast(card.plan.after === 'stop' ? 'План к экзамену завершён, карточка в архиве' : 'План завершён');
  changed(); render();
}

// ---------- Просмотр фото ----------
function bindViewer(root) { root.querySelectorAll('img[data-view]').forEach(img => img.onclick = e => { e.stopPropagation(); openViewer(img.dataset.view.split(','), +img.dataset.i); }); }
async function openViewer(ids, i) {
  viewer = { ids, i };
  const u = await photoUrl(ids[i], 'full');
  $('layer2').innerHTML = `<div class="viewer" id="viewer"><img src="${u}" alt="Фото"><button class="vx" id="vx" aria-label="Закрыть">✕</button>${ids.length > 1 ? `<div class="vn">${i + 1} из ${ids.length} · нажмите на фото для следующего</div>` : ''}</div>`;
  $('viewer').onclick = e => { if (e.target.tagName === 'IMG' && ids.length > 1) openViewer(ids, (i + 1) % ids.length); else closeViewer(); };
}
function closeViewer() { viewer = null; $('layer2').innerHTML = ''; }

// ---------- Календарь ----------
let calMonth = null, calSel = null, calDeck = '';
function monthStart(n) { const d = dateOf(n); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY; }
function monthEnd(n) { const d = dateOf(n); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / DAY; }
let projCache = { key: '', map: null };
function projections(until) {        // будущие шаги плана (после ближайшего повторения)
  const key = ver + ':' + today() + ':' + until;
  if (projCache.key === key) return projCache.map;
  const map = new Map();
  for (const c of state.cards) if (c.mode === 'plan' && !c.archived) for (const d of S.chain(c, until)) { if (!map.has(d)) map.set(d, []); map.get(d).push(c); }
  projCache = { key, map }; return map;
}
function dayInfo(d, until) {
  const t = today(), f = calDeck, inDeck = deck => !f || deck === f;
  if (d < t) {
    const h = state.hist.filter(x => x.d === d && inDeck(x.k));
    const legacy = !h.length && !f && state.log[d] && !state.hist.some(x => x.d === d) ? state.log[d] : 0;
    return { kind: 'past', hist: h, legacy, count: h.length || legacy, decks: [...new Set(h.map(x => x.k))] };
  }
  const items = (fc(until).days.get(d) || []).filter(x => inDeck(x.c.deck));
  const proj = d > t ? (projections(until).get(d) || []).filter(c => inDeck(c.deck)) : [];
  const h = d === t ? state.hist.filter(x => x.d === d && inDeck(x.k)) : [];
  return { kind: d === t ? 'today' : 'future', items, proj, hist: h, count: items.length + proj.length + h.length,
    decks: [...new Set([...items.map(x => x.c.deck), ...proj.map(c => c.deck), ...h.map(x => x.k)])] };
}
function renderCal() {
  const t = today();
  if (calSel === null) calSel = t;
  if (calMonth === null) calMonth = monthStart(calSel);
  if (calDeck && !decks().includes(calDeck)) calDeck = '';
  const until = Math.max(monthEnd(calMonth), calSel);
  const md = dateOf(calMonth), dim = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 0)).getUTCDate(), lead = (md.getUTCDay() + 6) % 7;
  const title = md.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' г.', '');
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cell out"></div>';
  for (let k = 0; k < dim; k++) {
    const d = calMonth + k, inf = dayInfo(d, until);
    const cls = ['cell', inf.kind, inf.count ? 'has' : '', d === t ? 'today' : '', d === calSel ? 'sel' : ''].join(' ');
    cells += `<button class="${cls}" data-d="${d}"><span class="num">${k + 1}</span>
      <span class="dots">${inf.decks.slice(0, 4).map(dk => `<i style="background:${deckColor(dk)}"></i>`).join('')}</span><span class="cnt">${inf.count || ''}</span></button>`;
  }
  $('app').innerHTML = `
    <header class="top"><div><p class="eyebrow">Повторения по дням</p><h1>Календарь</h1></div></header>
    ${decks().length > 1 ? `<div class="filters"><button class="chip" data-f="" aria-pressed="${!calDeck}">Все колоды</button>
      ${decks().map(d => `<button class="chip" data-f="${esc(d)}" aria-pressed="${calDeck === d}"><i style="background:${deckColor(d)}"></i>${esc(d)}</button>`).join('')}</div>` : ''}
    ${warnHtml()}
    <section class="panel">
      <div class="cal-head"><h2>${title}</h2>${calMonth !== monthStart(t) ? '<button id="calToday">Сегодня</button>' : ''}
        <button class="nav" id="prevM" aria-label="Предыдущий месяц">‹</button><button class="nav" id="nextM" aria-label="Следующий месяц">›</button></div>
      <div class="cal">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(w => `<div class="wdh">${w}</div>`).join('')}${cells}</div>
      <div class="legend"><span><i class="dot" style="background:var(--muted)"></i>цвет колоды</span><span>число: карточек в этот день с учётом лимитов</span></div>
    </section>
    <section class="panel" id="dayPanel">${dayPanel(calSel, until)}</section>`;
  document.querySelectorAll('.cell[data-d]').forEach(b => b.onclick = () => { calSel = +b.dataset.d; buzz('LIGHT'); renderCal(); $('dayPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { calDeck = b.dataset.f; renderCal(); });
  $('prevM').onclick = () => { calMonth = monthStart(calMonth - 1); renderCal(); };
  $('nextM').onclick = () => { calMonth = monthStart(calMonth + 32); renderCal(); };
  const ct = $('calToday'); if (ct) ct.onclick = () => { calSel = t; calMonth = monthStart(t); renderCal(); };
  bindDayPanel();
}
function rowCard(c, right, extra) {
  return `<button class="item" data-edit="${c.id}"><i class="bar-l" style="background:${deckColor(c.deck)}"></i>
    <span class="txt"><span class="q">${esc(c.q)}</span><span class="meta">${esc(c.deck)}${c.mode === 'plan' ? ' · по плану' : ''}${extra || ''}</span></span>${right || ''}</button>`;
}
function rowHist(h) {
  const g = gradeOf(h.g), exists = state.cards.some(c => c.id === h.id);
  return `<${exists ? `button class="item" data-edit="${h.id}"` : 'div class="item"'}><i class="bar-l" style="background:${deckColor(h.k)}"></i>
    <span class="txt"><span class="q">${esc(h.q)}</span><span class="meta">${esc(h.k)}${exists ? '' : ' · карточка удалена'}</span></span>
    <span class="gpill ${g.cls}">${g.name}</span></${exists ? 'button' : 'div'}>`;
}
function dayPanel(d, until) {
  const inf = dayInfo(d, until), t = today();
  const label = { past: ['Прошло', 'k-past'], today: ['Сегодня', 'k-today'], future: ['Запланировано', 'k-future'] }[inf.kind];
  let body = '';
  if (inf.kind === 'past') {
    if (inf.hist.length) {
      const tl = inf.hist.reduce((m, h) => (m[h.g] = (m[h.g] || 0) + 1, m), {});
      body = `<p class="muted small">Повторено ${cardsWord(inf.hist.length)}${tl.p ? `, по плану ${tl.p}` : ''}${tl[4] || tl[3] || tl[1] ? `: помню ${tl[4] || 0}, с трудом ${tl[3] || 0}, не помню ${tl[1] || 0}` : ''}</p><div class="list">${inf.hist.map(rowHist).join('')}</div>`;
    } else if (inf.legacy) body = `<p class="muted small">Повторено ${cardsWord(inf.legacy)}. Подробный список сохраняется начиная с версии 1.2.</p>`;
    else body = `<p class="muted small">${calDeck ? 'В этот день карточки этой колоды не повторялись.' : 'В этот день повторений не было.'}</p>`;
  } else {
    const its = inf.items, carried = its.filter(x => x.carried).length;
    const right = x => x.carried ? '<span class="when">перенесена</span>' : x.c.fresh ? '<span class="when now">новая</span>' : x.c.mode === 'plan' ? `<span class="when">шаг ${x.c.step + 1}</span>` : '';
    if (inf.kind === 'today') {
      const over = overflowNow(calDeck);
      body = its.length
        ? `<p class="muted small">Нужно повторить ${cardsWord(its.length)}${carried ? `, из них ${carried} перенесено с прошлых дней` : ''}.</p>
           <button class="primary big" id="calStart">Начать повторение</button><div class="list">${its.map(x => rowCard(x.c, right(x))).join('')}</div>`
        : `<p class="muted small">${state.cards.length ? 'На сегодня повторять нечего.' : 'Карточек пока нет.'}</p>`;
      if (over > 0) body += `<p class="muted small">Сверх лимита ждут ещё ${cardsWord(over)}: они перенесены на следующие дни.</p>`;
      if (inf.hist.length) body += `<p class="sub-h">Уже повторено сегодня</p><div class="list">${inf.hist.map(rowHist).join('')}</div>`;
    } else {
      body = its.length
        ? `<p class="muted small">${plural(its.length, 'Запланирована', 'Запланировано', 'Запланировано')} ${cardsWord(its.length)}${carried ? `, из них ${carried} переносится из-за лимита` : ''}. Умные карточки могут сдвинуться в зависимости от ответов.</p>
           <div class="list">${its.map(x => rowCard(x.c, right(x))).join('')}</div>`
        : (inf.proj.length ? '' : `<p class="muted small">На этот день ничего не запланировано.</p>`);
      if (inf.proj.length) body += `<p class="sub-h">Дальше по плану</p><p class="muted small">Эти повторения наступят, если до этого повторять карточки в срок.</p>
        <div class="list">${inf.proj.map(c => rowCard(c, '<span class="when">план</span>')).join('')}</div>`;
    }
  }
  const addLabel = d < t ? 'Добавить как выученную в этот день' : 'Добавить карточку на этот день';
  return `<div class="day-head"><h2>${cap(fmtLong(d))}${dateOf(d).getUTCFullYear() !== dateOf(t).getUTCFullYear() ? ' ' + dateOf(d).getUTCFullYear() : ''}</h2><span class="kind ${label[1]}">${label[0]}</span></div>${body}
    <button id="calAdd">${ICON.plus.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px;stroke:currentColor;stroke-width:2.4;fill:none"')} ${addLabel}</button>`;
}
function bindDayPanel() {
  const s = $('calStart'); if (s) s.onclick = () => startSession(calDeck);
  $('calAdd').onclick = () => openSheet(null, { start: calSel, deck: calDeck });
  document.querySelectorAll('#dayPanel [data-edit]').forEach(b => b.onclick = () => openSheet(b.dataset.edit));
}

// ---------- Карточки ----------
function renderCards() {
  const q = cardQuery.trim().toLowerCase();
  if (cardFilter && cardFilter !== '__arch' && !decks().includes(cardFilter)) cardFilter = '';
  const arch = cardFilter === '__arch', nArch = state.cards.filter(c => c.archived).length;
  const list = state.cards.filter(c => (arch ? c.archived : !c.archived && (!cardFilter || c.deck === cardFilter)) && (!q || (c.q + ' ' + c.a).toLowerCase().includes(q))).sort((a, b) => a.due - b.due);
  const active = state.cards.filter(c => !c.archived).length;
  $('app').innerHTML = `
    <header class="top"><div><p class="eyebrow">${cardsWord(active)}${nArch ? ` · в архиве ${nArch}` : ''}</p><h1>Карточки</h1></div></header>
    ${state.cards.length ? `<div class="search">${ICON.search}<input id="q" type="search" placeholder="Поиск по вопросам и ответам" value="${esc(cardQuery)}"></div>
    <div class="filters"><button class="chip" data-f="" aria-pressed="${!cardFilter}">Все</button>
      ${activeDecks().map(d => `<button class="chip" data-f="${esc(d)}" aria-pressed="${cardFilter === d}"><i style="background:${deckColor(d)}"></i>${esc(d)}</button>`).join('')}
      ${nArch ? `<button class="chip" data-f="__arch" aria-pressed="${arch}">Архив · ${nArch}</button>` : ''}</div>` : ''}
    <section class="list">
      ${list.map(c => { const d = c.due - today(), ph = c.qPh[0] || c.aPh[0], nph = c.qPh.length + c.aPh.length;
        return `<button class="item" data-edit="${c.id}"><i class="bar-l" style="background:${deckColor(c.deck)}"></i>
        ${ph ? `<img class="thumb" data-ph="${ph}" data-kind="thumb" alt="">` : ''}
        <span class="txt"><span class="q">${esc(c.q)}</span><span class="meta">${esc(c.deck)}${c.mode === 'plan' ? ' · по плану' : ''}${c.fresh ? ' · новая' : ''}${nph ? ` · фото: ${nph}` : ''}</span></span>
        <span class="when ${!c.archived && d <= 0 ? 'now' : ''}">${c.archived ? 'в архиве' : d <= 0 ? 'сегодня' : d === 1 ? 'завтра' : fmtS(c.due)}</span></button>`; }).join('')
        || `<div class="panel center"><div class="empty-art">${EMPTY_ART}</div><h2>${q ? 'Ничего не нашлось' : 'Пока пусто'}</h2><p class="muted small">${q ? 'Попробуйте другое слово.' : 'Нажмите «+», чтобы создать карточку, или загрузите их из таблицы в настройках.'}</p></div>`}
    </section>
    <button class="fab" id="fab" aria-label="Новая карточка">${ICON.plus}</button>`;
  hydrate($('app'));
  const qi = $('q');
  if (qi) qi.oninput = () => { cardQuery = qi.value; const pos = qi.selectionStart; renderCards(); const n = $('q'); n.focus(); n.setSelectionRange(pos, pos); };
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { cardFilter = b.dataset.f; renderCards(); });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openSheet(b.dataset.edit));
  $('fab').onclick = () => openSheet(null, { deck: cardFilter === '__arch' ? '' : cardFilter });
}

// ---------- Лист создания / редактирования ----------
function seg(name, opts, val) { return `<div class="segc" role="group">${opts.map(([v, l]) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${v === val}">${l}</button>`).join('')}</div>`; }
function parseSteps(s) { const a = String(s || '').split(/[^\d]+/).map(Number).filter(n => n > 0 && n < 20000); return a.length ? a : null; }
function openSheet(id, opts = {}) {
  const c = id ? state.cards.find(x => x.id === id) : null;
  if (id && !c) return;
  const ex = pick(C.examples, 'ex'), t = today();
  const deck0 = c ? c.deck : opts.deck || cardFilter && cardFilter !== '__arch' && cardFilter || activeDecks()[0] || 'Общая';
  const dc = cfg(deck0);
  sheet = { id: c ? c.id : null, qPh: c ? [...c.qPh] : [], aPh: c ? [...c.aPh] : [], created: [], removed: [], busy: 0,
    mode: c ? c.mode : dc.mode,
    plan: c && c.plan ? { ...c.plan } : { kind: 'classic', exam: t + 30, after: 'continue', steps: [1, 2, 5, 10] },
    start: c ? c.due : (opts.start ?? t), modeTouched: false };
  $('layer').innerHTML = `<div class="sheet-bg" id="sbg"></div>
    <form class="sheet" id="sheet"><div class="grab"></div><div class="in">
      <h2>${c ? (c.archived ? 'Карточка в архиве' : 'Карточка') : 'Новая карточка'}</h2>
      <label>Вопрос<textarea id="fQ" rows="2" style="min-height:70px" placeholder="${esc(ex[0])}">${c ? esc(c.q) : ''}</textarea></label>
      <div class="ph-row" id="ph-q"></div>
      <label>Ответ<textarea id="fA" rows="2" style="min-height:70px" placeholder="${esc(ex[1])}">${c ? esc(c.a) : ''}</textarea></label>
      <div class="ph-row" id="ph-a"></div>
      <label>Колода<input id="fD" list="deckList" required value="${esc(deck0)}"></label>
      <datalist id="deckList">${decks().map(d => `<option value="${esc(d)}">`).join('')}</datalist>
      <div class="field"><span class="flabel">Расписание</span>${seg('mode', [['smart', 'Умное'], ['plan', 'По плану']], sheet.mode)}<p class="muted small" id="modeHint"></p></div>
      <div id="planBox"></div>
      <label>${c ? 'Следующее повторение' : 'Когда начать'}<input type="date" id="fStart" value="${toISO(sheet.start)}"></label>
      <p class="muted small" id="startHint"></p>
      ${c && !c.archived ? `<div id="timeline"></div>` : ''}
      <p class="muted small" id="sheetErr" hidden></p>
      <div class="row2">${c ? '<button type="button" id="del" class="danger">Удалить</button>' : '<button type="button" id="cancel">Отмена</button>'}<button class="primary" type="submit">${c ? 'Сохранить' : 'Добавить'}</button></div>
      ${c ? `<div class="row2">${c.archived ? '<button type="button" id="unarch">Вернуть из архива</button>' : `<button type="button" id="arch">Знаю навсегда</button>${c.mode === 'plan' && !c.fresh ? '<button type="button" id="restart">Начать план заново</button>' : ''}`}</div>` : ''}
    </div></form>`;
  renderPhRow('q'); renderPhRow('a'); renderPlanBox(); updateHints();
  $('sbg').onclick = () => closeSheet();
  const cancel = $('cancel'); if (cancel) cancel.onclick = () => closeSheet();
  $('fD').oninput = () => { if (!c && !sheet.modeTouched) { sheet.mode = cfg($('fD').value.trim()).mode; syncSeg(); renderPlanBox(); } updateHints(); };
  $('fStart').onchange = () => { const v = fromISO($('fStart').value); if (v != null) sheet.start = v; updateHints(); };
  $('sheet').addEventListener('click', e => {
    const b = e.target.closest('[data-seg]'); if (!b) return;
    const k = b.dataset.seg, v = b.dataset.v;
    if (k === 'mode') { sheet.mode = v; sheet.modeTouched = true; }
    if (k === 'kind') sheet.plan.kind = v;
    if (k === 'after') sheet.plan.after = v;
    syncSeg(); renderPlanBox(); updateHints(); buzz('LIGHT');
  });
  let sure = false;
  const del = $('del'); if (del) del.onclick = () => {
    if (!sure) { sure = true; del.textContent = 'Точно удалить?'; return; }
    [...c.qPh, ...c.aPh, ...sheet.created].forEach(photoDel);
    state.cards = state.cards.filter(x => x.id !== c.id);
    sheet = null; $('layer').innerHTML = ''; changed(); render(); toast('Карточка удалена');
  };
  const ar = $('arch'); if (ar) ar.onclick = () => { c.archived = true; sheet.created.forEach(photoDel); sheet = null; $('layer').innerHTML = ''; changed(); render(); toast('Карточка в архиве. Вернуть можно в «Карточки → Архив»'); };
  const ua = $('unarch'); if (ua) ua.onclick = () => { c.archived = false; c.due = c.nom = today(); sheet = null; $('layer').innerHTML = ''; changed(); render(); toast('Карточка вернулась, повторение сегодня'); };
  const rs = $('restart'); if (rs) rs.onclick = () => { c.step = 0; c.due = c.nom = today(); c.interval = 0; c.pin = false; sheet = null; $('layer').innerHTML = ''; changed(); render(); toast('План начат заново, повторение сегодня'); };
  $('sheet').onsubmit = e => { e.preventDefault(); submitSheet(c); };
  if (!c) setTimeout(() => $('fQ') && $('fQ').focus(), 250);
}
function syncSeg() {
  document.querySelectorAll('[data-seg]').forEach(b => {
    const k = b.dataset.seg, cur = k === 'mode' ? sheet.mode : k === 'kind' ? sheet.plan.kind : sheet.plan.after;
    b.setAttribute('aria-pressed', String(b.dataset.v === cur));
  });
}
function renderPlanBox() {
  const box = $('planBox'); if (!box || !sheet) return;
  const p = sheet.plan;
  if (sheet.mode !== 'plan') { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="field"><span class="flabel">План</span>${seg('kind', [['classic', 'Классический'], ['exam', 'К экзамену'], ['custom', 'Свой']], p.kind)}</div>
    ${p.kind === 'exam' ? `<label>Дата экзамена<input type="date" id="fExam" value="${toISO(p.exam || today() + 30)}"></label>
      <div class="field"><span class="flabel">После экзамена</span>${seg('after', [['continue', 'Продолжить надолго'], ['stop', 'В архив']], p.after || 'continue')}</div>` : ''}
    ${p.kind === 'custom' ? `<label>Интервалы в днях<input id="fSteps" inputmode="numeric" value="${esc((p.steps || [1, 2, 5, 10]).join(', '))}" placeholder="1, 2, 5, 10"></label>
      <p class="muted small">После последнего интервала каждый следующий будет вдвое длиннее.</p>` : ''}`;
  const fe = $('fExam'); if (fe) fe.onchange = () => { const v = fromISO(fe.value); if (v != null) p.exam = v; updateHints(); };
  const fs = $('fSteps'); if (fs) fs.oninput = () => { const a = parseSteps(fs.value); if (a) p.steps = a; updateHints(); };
}
// Предпросмотр: подсказки под режимом и датой, лента плана
function draftCard() {
  const c = sheet.id ? state.cards.find(x => x.id === sheet.id) : null;
  const d = { id: 'draft', deck: ($('fD') && $('fD').value.trim()) || 'Общая', mode: sheet.mode, plan: sheet.mode === 'plan' ? { ...sheet.plan } : undefined,
    due: sheet.start, nom: sheet.start, step: 0, fresh: true, reps: 0, interval: 0, ease: 2.5, last: null };
  if (c) { Object.assign(d, { step: c.mode === 'plan' ? c.step : (c.fresh ? 0 : 1), fresh: c.fresh, last: c.last, reps: c.reps, interval: c.interval }); d.due = sheet.start; }
  else setStartDraft(d);
  if (d.mode === 'plan' && d.plan.kind === 'exam') d.plan.dates = S.examDates(c && c.start != null ? c.start : sheet.start, d.plan.exam);
  return d;
}
function setStartDraft(d) {
  const t = today();
  if (d.mode === 'plan' && d.plan.kind === 'exam') d.plan.dates = S.examDates(sheet.start, d.plan.exam);
  if (sheet.start >= t) return;
  d.fresh = false; d.last = sheet.start;
  if (d.mode === 'plan') { const n = S.planNext({ ...d, step: 0 }, sheet.start); if (!n.finished) { d.due = n.due; d.step = n.step; } }
  else d.due = sheet.start + 1;
}
function updateHints() {
  if (!sheet) return;
  const t = today(), mh = $('modeHint'), sh = $('startHint'), tl = $('timeline');
  if (mh) mh.textContent = sheet.mode === 'plan' ? 'Даты известны заранее. При повторении одна кнопка «Повторил». Если день пропущен, карточка ждёт, пока вы её не повторите, и план сдвигается.'
    : 'Интервалы зависят от ваших ответов: «Не помню», «С трудом», «Помню».';
  const d = draftCard();
  if (sh) {
    if (sheet.id) sh.textContent = sheet.start < t ? 'Дата в прошлом: карточка будет считаться просроченной.' : '';
    else sh.textContent = sheet.start > t ? `Карточка появится в повторении ${fmtY(sheet.start)}.` : sheet.start < t ? `Будет считаться выученной ${fmtY(sheet.start)}: первое повторение ${d.due <= t ? 'уже сегодня' : fmtY(d.due)}.` : '';
  }
  // лента плана
  const host = tl || $('planBox');
  let line = $('planLine');
  if (sheet.mode === 'plan') {
    const dates = planPreviewDates(d, 60);
    const near = dates.slice(0, 7), far = dates.slice(7);
    const years = [...new Set(far.map(x => dateOf(x).getUTCFullYear()))].slice(0, 5);
    const c = sheet.id ? state.cards.find(x => x.id === sheet.id) : null;
    const done = c ? state.hist.filter(h => h.id === c.id).map(h => h.d) : [];
    const html = `<div class="tline">${done.slice(-4).map(x => `<span class="tl done">✓ ${fmtS(x)}</span>`).join('')}${near.map((x, i) => `<span class="tl ${i === 0 ? 'next' : ''}">${fmtS(x)}${dateOf(x).getUTCFullYear() !== dateOf(t).getUTCFullYear() ? ' ' + String(dateOf(x).getUTCFullYear()).slice(2) : ''}</span>`).join('')}${years.length ? `<span class="tl far">дальше: ${years.join(', ')}${far.length > 5 ? '…' : ''}</span>` : ''}</div>`;
    if (!line) { line = document.createElement('div'); line.id = 'planLine'; line.className = 'field'; host.appendChild(line); }
    line.innerHTML = `<span class="flabel">Повторения</span>${html}`;
    if (tl && line.parentNode !== tl) tl.appendChild(line);
  } else if (line) line.remove();
}
function submitSheet(c) {
  const q = $('fQ').value.trim(), a = $('fA').value.trim(), deck = $('fD').value.trim() || 'Общая', err = $('sheetErr');
  if (sheet.busy) { err.hidden = false; err.textContent = 'Подождите, фото ещё обрабатывается.'; return; }
  if (!q && !sheet.qPh.length) { err.hidden = false; err.textContent = 'Напишите вопрос или прикрепите к нему фото.'; return; }
  if (!a && !sheet.aPh.length) { err.hidden = false; err.textContent = 'Напишите ответ или прикрепите к нему фото.'; return; }
  if (sheet.mode === 'plan' && sheet.plan.kind === 'exam' && !(sheet.plan.exam > (c ? today() : sheet.start))) { err.hidden = false; err.textContent = 'Дата экзамена должна быть позже даты начала.'; return; }
  sheet.removed.forEach(photoDel);
  const qText = q || '(вопрос на фото)', aText = a || '(ответ на фото)';
  const plan = sheet.mode === 'plan' ? { kind: sheet.plan.kind, ...(sheet.plan.kind === 'exam' ? { exam: sheet.plan.exam, after: sheet.plan.after || 'continue' } : {}), ...(sheet.plan.kind === 'custom' ? { steps: sheet.plan.steps } : {}) } : undefined;
  if (c) {
    Object.assign(c, { q: qText, a: aText, deck, qPh: sheet.qPh, aPh: sheet.aPh });
    if (c.mode !== sheet.mode) {
      if (sheet.mode === 'plan') { c.step = c.fresh ? 0 : 1; }
      else { c.reps = c.fresh ? 0 : 1; c.interval = c.interval || (c.fresh ? 0 : 1); c.ease = c.ease || 2.5; }
      c.mode = sheet.mode;
    }
    c.plan = plan;
    if (plan && plan.kind === 'exam') c.plan.dates = S.examDates(c.start != null && c.start < plan.exam ? c.start : today(), plan.exam);
    if (sheet.start !== c.due) { c.due = c.nom = sheet.start; c.pin = true; }
  } else {
    state.cards.push(newCard(qText, aText, deck, { mode: sheet.mode, plan, qPh: sheet.qPh, aPh: sheet.aPh, start: sheet.start }));
  }
  rebalanceAll(); changed(); buzz('LIGHT');
  const keepStart = sheet.start;
  sheet = null; $('layer').innerHTML = ''; render();
  if (c) toast('Сохранено');
  else { openSheet(null, { start: keepStart, deck }); toast(keepStart > today() ? `Добавлено на ${fmtY(keepStart)}. Можно сразу следующую` : 'Добавлено. Можно сразу следующую'); }
}
function renderPhRow(side) {
  const row = $('ph-' + side); if (!row || !sheet) return;
  const ids = sheet[side + 'Ph'];
  row.innerHTML = ids.map((id, i) => `<span class="ph-th"><img data-ph="${id}" data-kind="thumb" data-view="${ids.join(',')}" data-i="${i}" alt="Фото"><button type="button" class="ph-x" data-rm="${id}" aria-label="Убрать фото">✕</button></span>`).join('')
    + (sheet.busy && sheet.busySide === side ? Array.from({ length: sheet.busy }, () => '<span class="ph-busy">…</span>').join('') : '')
    + (ids.length < MAX_PHOTOS ? `<button type="button" class="ph-add" data-side="${side}">${ICON.camera}Фото ${side === 'q' ? 'к вопросу' : 'к ответу'}</button>` : '');
  hydrate(row); bindViewer(row);
  row.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    const pid = b.dataset.rm;
    sheet[side + 'Ph'] = sheet[side + 'Ph'].filter(x => x !== pid);
    if (sheet.created.includes(pid)) { sheet.created = sheet.created.filter(x => x !== pid); photoDel(pid); } else sheet.removed.push(pid);
    renderPhRow(side);
  });
  const add = row.querySelector('.ph-add'); if (add) add.onclick = () => photoMenu(side);
}
function photoMenu(side) {
  if (!Camera) { pickFiles(side); return; }
  menuOpen = true;
  $('layer2').innerHTML = `<div class="menu-bg" id="mbg"></div><div class="menu"><div class="in">
    <h2>Фото ${side === 'q' ? 'к вопросу' : 'к ответу'}</h2>
    <button class="opt" id="mCam"><span class="ic">${ICON.camera}</span><span class="t">Сфотографировать<small>Откроется камера</small></span></button>
    <button class="opt" id="mGal"><span class="ic">${ICON.image}</span><span class="t">Выбрать из галереи<small>Можно сразу несколько</small></span></button>
    <button id="mCancel">Отмена</button></div></div>`;
  const close = () => { menuOpen = false; $('layer2').innerHTML = ''; };
  $('mbg').onclick = close; $('mCancel').onclick = close;
  $('mCam').onclick = async () => {
    close();
    try { const r = await Camera.getPhoto({ source: 'CAMERA', resultType: 'uri', quality: 85, correctOrientation: true, saveToGallery: false }); await addPhotos(side, [r.webPath]); }
    catch (e) { if (!/cancel/i.test(String(e && e.message))) toast('Не удалось сделать фото'); }
  };
  $('mGal').onclick = async () => {
    close();
    const left = MAX_PHOTOS - sheet[side + 'Ph'].length;
    try { const r = await Camera.pickImages({ quality: 85, limit: left }); await addPhotos(side, r.photos.slice(0, left).map(p => p.webPath)); }
    catch (e) { if (!/cancel/i.test(String(e && e.message))) toast('Не удалось открыть галерею'); }
  };
}
function pickFiles(side) {
  const inp = $('filePick'); inp.value = '';
  inp.onchange = () => { const left = MAX_PHOTOS - sheet[side + 'Ph'].length; addPhotos(side, [...inp.files].slice(0, left)); };
  inp.click();
}
async function addPhotos(side, sources) {
  if (!sheet || !sources.length) return;
  const sh = sheet;
  sh.busy = sources.length; sh.busySide = side; renderPhRow(side);
  for (const s of sources) {
    try {
      const blob = typeof s === 'string' ? await (await fetch(s)).blob() : s;
      const id = await processImage(blob);
      if (sheet !== sh) { photoDel(id); return; }
      sh[side + 'Ph'].push(id); sh.created.push(id);
    } catch (e) { console.error(e); toast('Не удалось обработать одно из фото'); }
    sh.busy--; renderPhRow(side);
  }
  sh.busy = 0; renderPhRow(side); buzz('LIGHT');
}
function closeSheet() {
  if (!sheet) { $('layer').innerHTML = ''; return; }
  sheet.created.forEach(photoDel);
  sheet = null; $('layer').innerHTML = '';
}

// ---------- Импорт с распределением ----------
function splitLine(line, sep) {
  const res = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === sep && !inQ) { res.push(cur); cur = ''; } else cur += ch; }
  res.push(cur); return res;
}
function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const sep = lines.length && lines[0].includes(';') ? ';' : ',';
  return lines.map(l => splitLine(l, sep).map(s => s.trim())).filter(c => c.length >= 2 && c[0] && c[1] && !/^(вопрос|question|front)$/i.test(c[0])).map(c => ({ q: c[0], a: c[1], deck: c[2] || '' }));
}
let imp = null;      // { rows, start, how: 'all'|'perday'|'manual', per, manual: [] }
function impPlan() {  // массив дней для каждой строки
  const n = imp.rows.length, out = [];
  if (imp.how === 'all') return imp.rows.map(() => imp.start);
  if (imp.how === 'perday') { for (let i = 0; i < n; i++) out.push(imp.start + Math.floor(i / Math.max(1, imp.per))); return out; }
  let day = 0, used = 0;
  for (let i = 0; i < n; i++) {
    while ((imp.manual[day] ?? imp.per) <= used) { day++; used = 0; if (day > 3650) break; }
    out.push(imp.start + day); used++;
  }
  return out;
}
function impDays() { const p = impPlan(), m = new Map(); p.forEach((d, i) => { const k = d; if (!m.has(k)) m.set(k, []); m.get(k).push(imp.rows[i]); }); return m; }
function renderImport(box) {
  if (!imp || !imp.rows.length) { box.innerHTML = ''; return; }
  const def = $('impDeck') ? $('impDeck').value.trim() : imp.deck;
  imp.deck = def || 'Импорт';
  const days = impDays(), keys = [...days.keys()].sort((a, b) => a - b);
  const warns = [];
  for (const d of keys) {
    const per = days.get(d).reduce((m, r) => { const dk = r.deck || imp.deck; m[dk] = (m[dk] || 0) + 1; return m; }, {});
    for (const [dk, k] of Object.entries(per)) if (k > limitOf(dk)) warns.push(`${fmtS(d)}: в «${esc(dk)}» ${k} при лимите ${limitOf(dk)}`);
  }
  box.innerHTML = `<div class="field"><span class="flabel">Найдено ${cardsWord(imp.rows.length)}. Как распределить?</span>
      ${seg('how', [['all', 'Все в один день'], ['perday', 'По N в день'], ['manual', 'Вручную']], imp.how)}</div>
    <label>Начать с<input type="date" id="impStart" min="${toISO(today())}" value="${toISO(imp.start)}"></label>
    ${imp.how !== 'all' ? `<label>${imp.how === 'manual' ? 'По умолчанию в день' : 'Сколько в день'}<input type="number" id="impPer" min="1" max="500" value="${imp.per}"></label>` : ''}
    ${imp.how === 'manual' ? `<div class="mrows">${keys.map((d, i) => `<label class="mrow"><span>${cap(wd(d))}, ${fmtS(d)}</span><input type="number" min="0" max="500" data-mi="${i}" value="${days.get(d).length}"></label>`).join('')}</div>
      <p class="muted small">Меняйте числа по дням, остальные карточки распределятся по умолчанию дальше.</p>` : `<p class="muted small">${keys.length > 1 ? `С ${fmtS(keys[0])} по ${fmtS(keys[keys.length - 1])}, ${daysWord(keys.length)}.` : `Все на ${fmtS(keys[0])}.`}</p>`}
    ${warns.length ? `<p class="note warn">Больше лимита колоды: ${warns.slice(0, 4).join('; ')}${warns.length > 4 ? '…' : ''}. Лишние карточки перенесутся на следующие дни.</p>` : ''}
    <label>Колода, если в таблице не указана<input id="impDeck" value="${esc(imp.deck)}"></label>
    <button class="primary" id="doImport">Загрузить ${cardsWord(imp.rows.length)}</button>`;
  box.querySelectorAll('[data-seg="how"]').forEach(b => b.onclick = () => { imp.how = b.dataset.v; if (imp.how === 'manual') imp.manual = []; renderImport(box); });
  $('impStart').onchange = e => { const v = fromISO(e.target.value); if (v != null) imp.start = Math.max(today(), v); renderImport(box); };
  const per = $('impPer'); if (per) per.onchange = () => { imp.per = Math.max(1, +per.value || 1); renderImport(box); };
  box.querySelectorAll('[data-mi]').forEach(inp => inp.onchange = () => {
    const i = +inp.dataset.mi;
    const cur = impDays(), ks = [...cur.keys()].sort((a, b) => a - b);
    imp.manual = ks.slice(0, i).map(d => cur.get(d).length);
    imp.manual[i] = Math.max(0, +inp.value || 0);
    renderImport(box);
  });
  $('impDeck').onchange = () => renderImport(box);
  $('doImport').onclick = () => {
    const plan = impPlan();
    imp.rows.forEach((r, i) => state.cards.push(newCard(r.q, r.a, r.deck || imp.deck, { start: plan[i] })));
    const n = imp.rows.length; imp = null;
    rebalanceAll(); changed(); morePanel = ''; render(); toast(`Загружено: ${cardsWord(n)}`);
  };
}

// ---------- Настройки ----------
const csvCell = s => /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
async function copy(area) { try { await navigator.clipboard.writeText(area.value); toast('Скопировано'); } catch (e) { area.focus(); area.select(); toast('Текст выделен, скопируйте его'); } }
let morePanel = '', openDeck = '';
function renderMore() {
  const permOk = permission === 'granted' || !isNative, st = state.settings, th = state.theme;
  const opt = (id, icon, title, sub) => `<button class="opt" data-p="${id}"><span class="ic">${icon}</span><span class="t">${title}<small>${sub}</small></span><span class="muted">${morePanel === id ? '⌃' : '›'}</span></button>`;
  const inner = html => `<div class="panel" style="border:0;border-radius:0">${html}</div>`;
  const dk = decks();
  $('app').innerHTML = `
    <header><p class="eyebrow">Карточки 1.3</p><h1>Настройки</h1></header>
    <section class="group">
      <div class="deckrow"><div class="nm">${ICON.palette.replace('<svg', '<svg style="width:20px;height:20px;stroke:var(--accent);stroke-width:2;fill:none"')}<span>Тема</span></div>
        <div class="themes">${Object.entries(TH.P).map(([k, p]) => `<button class="theme" data-pal="${k}" aria-pressed="${th.pal === k}"><i style="background:${p[TH.isDark() ? 'dark' : 'light'][6]}"></i><span>${p.name}</span></button>`).join('')}</div>
        ${seg('tmode', [['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], th.mode)}</div>
    </section>
    <section class="group">
      <label class="opt"><span class="ic">${ICON.bell}</span><span class="t">Напоминания<small>${st.remind ? (permOk ? 'В дни, когда есть карточки' : 'Нет разрешения на уведомления') : 'Выключены'}</small></span><input type="checkbox" class="toggle" id="remOn" ${st.remind ? 'checked' : ''}></label>
      <label class="opt" ${st.remind ? '' : 'style="opacity:.5"'}><span class="ic">${ICON.clock}</span><span class="t">Время<small>Ежедневно, если есть что повторить</small></span><input type="time" class="tm" id="remTime" value="${st.time}" ${st.remind ? '' : 'disabled'}></label>
      <button class="opt" id="testN"><span class="ic">${ICON.info}</span><span class="t">Проверить уведомление<small>Придёт через 10 секунд</small></span><span class="muted">›</span></button>
    </section>
    ${isNative && st.remind && !permOk ? `<p class="note warn">Без разрешения напоминания не придут. Нажмите «Проверить уведомление», и телефон спросит разрешение.</p>` : ''}
    <section class="group">
      ${opt('col', ICON.decks, 'Колоды', dk.length ? 'Лимит в день, расписание, цвет' : 'Колод пока нет')}
      ${morePanel === 'col' ? (dk.length ? dk.map(d => { const cf = cfg(d), open = openDeck === d;
        return `<div class="deckrow"><button class="nm nmb" data-od="${esc(d)}"><i class="dot" style="background:${deckColor(d)};width:14px;height:14px"></i><span>${esc(d)}</span><small class="muted">${cf.limit} в день · ${cf.mode === 'plan' ? 'по плану' : 'умное'}</small><span class="muted">${open ? '⌃' : '›'}</span></button>
          ${open ? `<div class="field"><span class="flabel">Тип колоды и лимит в день</span>
              <div class="segc" role="group">${Object.entries(DECK_TYPES).map(([k, v]) => `<button type="button" data-dt="${k}" data-deck="${esc(d)}" aria-pressed="${cf.type === k}">${v.name}${v.limit ? ` · ${v.limit}` : ''}</button>`).join('')}</div>
              ${cf.type === 'custom' ? `<label class="mrow"><span>Карточек в день</span><input type="number" min="1" max="500" data-dl="${esc(d)}" value="${cf.limit}"></label>` : ''}</div>
            <div class="field"><span class="flabel">Расписание для новых карточек</span><div class="segc" role="group">${[['smart', 'Умное'], ['plan', 'По плану']].map(([v, l]) => `<button type="button" data-dm="${v}" data-deck="${esc(d)}" aria-pressed="${cf.mode === v}">${l}</button>`).join('')}</div></div>
            <div class="field"><span class="flabel">Цвет</span><div class="swatches">${Array.from({ length: PALETTE }, (_, i) => `<button class="sw" style="background:var(--c${i})" data-deckc="${esc(d)}" data-ci="${i}" aria-label="Цвет ${i + 1}" aria-pressed="${state.colors[d] === i}"></button>`).join('')}</div></div>` : ''}
          </div>`; }).join('') : inner('<p class="muted small">Создайте карточку, и её колода появится здесь.</p>')) : ''}
    </section>
    <section class="group">
      ${opt('imp', ICON.down, 'Загрузить из таблицы', 'CSV: вопрос;ответ;колода')}
      ${morePanel === 'imp' ? inner(`
        <p class="muted small">Сохраните таблицу из Excel как «CSV UTF-8». Колонку колоды можно не заполнять.</p>
        <input type="file" id="csvFile" accept=".csv,.txt,text/csv,text/plain">
        <textarea id="csvText" spellcheck="false" placeholder="${esc(pick(C.examples, 'csv').join(';'))};Общая"></textarea>
        <p class="muted small" id="importInfo"></p><div id="impBox" class="impbox"></div>`) : ''}
      ${opt('exp', ICON.up, 'Резервная копия', 'Все карточки текстом, без фото')}
      ${morePanel === 'exp' ? inner(`<textarea id="exportText" readonly>${esc(state.cards.map(c => [c.q, c.a, c.deck].map(csvCell).join(';')).join('\n'))}</textarea><button id="copyExp">Копировать</button>`) : ''}
      ${opt('lab', ICON.flask, 'Для проверки прототипа', 'Перемотка даты и параметры расписания')}
      ${morePanel === 'lab' ? inner(`
        <p class="muted small">Дата в приложении: <b>${fmt(today())}</b>${state.offset ? ` (+${daysWord(state.offset)})` : ''}</p>
        <div class="row2"><button id="d1">+1 день</button><button id="d7">+7 дней</button><button id="d0" ${state.offset ? '' : 'disabled'}>Сегодня</button></div>
        ${state.cards.length ? `<div class="scroll"><table><thead><tr><th>Вопрос</th><th>Режим</th><th>Срок</th><th>Интервал</th><th>Шаг / подряд</th></tr></thead><tbody>
          ${state.cards.map(c => `<tr><td>${esc(c.q)}</td><td>${c.mode === 'plan' ? 'план' : 'умное'}${c.archived ? ', архив' : ''}</td><td class="num">${fmtS(c.due)}</td><td class="num">${c.interval} дн.</td><td class="num">${c.mode === 'plan' ? c.step : c.reps}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <button id="onbAgain">Показать знакомство заново</button>
        <button id="wipe" class="danger">Удалить все карточки и историю</button>`) : ''}
    </section>
    <p class="foot">Умное расписание работает по алгоритму SM-2, «По плану» — по фиксированным интервалам на основе кривой забывания Эббингауза.</p>`;

  document.querySelectorAll('[data-pal]').forEach(b => b.onclick = () => { th.pal = b.dataset.pal; save(); applyTheme(); buzz('LIGHT'); renderMore(); });
  document.querySelectorAll('[data-seg="tmode"]').forEach(b => b.onclick = () => { th.mode = b.dataset.v; save(); applyTheme(); renderMore(); });
  $('remOn').onchange = async e => { st.remind = e.target.checked; save(); if (st.remind) await ensurePermission(true); await scheduleReminders(); renderMore(); };
  $('remTime').onchange = async e => { if (!e.target.value) return; st.time = e.target.value; save(); await scheduleReminders(); toast('Напоминание в ' + st.time); };
  $('testN').onclick = testNotification;
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { morePanel = morePanel === b.dataset.p ? '' : b.dataset.p; renderMore(); });
  document.querySelectorAll('[data-od]').forEach(b => b.onclick = () => { openDeck = openDeck === b.dataset.od ? '' : b.dataset.od; renderMore(); });
  const setCfg = (d, patch) => { state.deckCfg[d] = Object.assign(cfg(d), patch); rebalanceAll(); changed(); renderMore(); };
  document.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => { const t = b.dataset.dt; setCfg(b.dataset.deck, { type: t, ...(DECK_TYPES[t].limit ? { limit: DECK_TYPES[t].limit } : {}) }); });
  document.querySelectorAll('[data-dl]').forEach(i => i.onchange = () => setCfg(i.dataset.dl, { limit: Math.max(1, Math.min(500, +i.value || 1)) }));
  document.querySelectorAll('[data-dm]').forEach(b => b.onclick = () => setCfg(b.dataset.deck, { mode: b.dataset.dm }));
  document.querySelectorAll('[data-deckc]').forEach(b => b.onclick = () => { state.colors[b.dataset.deckc] = +b.dataset.ci; save(); buzz('LIGHT'); renderMore(); });
  if (morePanel === 'imp') {
    const box = $('impBox');
    const parse = () => {
      const rows = parseCSV($('csvText').value);
      if (!rows.length) { imp = null; $('importInfo').textContent = $('csvText').value.trim() ? 'Не нашлось строк вида «вопрос;ответ». Проверьте разделитель «;».' : ''; renderImport(box); return; }
      $('importInfo').textContent = '';
      imp = Object.assign({ start: today(), how: 'all', per: 10, manual: [], deck: 'Импорт' }, imp || {}, { rows });
      renderImport(box);
    };
    $('csvFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('csvText').value = r.result; parse(); }; r.readAsText(f, 'utf-8'); };
    $('csvText').oninput = parse;
    if (imp) { $('csvText').value = imp.rows.map(r => [r.q, r.a, r.deck].filter((x, i) => i < 2 || x).map(csvCell).join(';')).join('\n'); renderImport(box); }
  }
  if (morePanel === 'exp') $('copyExp').onclick = () => copy($('exportText'));
  if (morePanel === 'lab') {
    const shift = n => () => { state.offset = n === 0 ? 0 : state.offset + n; calSel = null; calMonth = null; save(); scheduleReminders(); render(); toast('Дата: ' + fmt(today())); };
    $('d1').onclick = shift(1); $('d7').onclick = shift(7); $('d0').onclick = shift(0);
    $('onbAgain').onclick = () => { onbStep = 0; morePanel = ''; go('onboarding'); };
    let sure = false;
    $('wipe').onclick = async e => {
      if (!sure) { sure = true; e.target.textContent = 'Удалить безвозвратно? Нажмите ещё раз'; return; }
      state.cards = []; state.offset = 0; state.log = {}; state.hist = []; state.colors = {}; state.deckCfg = {};
      await photoClear().catch(() => {}); urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
      changed(); morePanel = ''; render(); toast('Все карточки удалены');
    };
  }
}

// ---------- Запуск ----------
document.querySelectorAll('nav [data-go]').forEach(b => b.onclick = () => {
  session = null; buzz('LIGHT');
  if (b.dataset.go === 'cal' && screen !== 'cal') { calSel = today(); calMonth = null; }
  go(b.dataset.go);
});
window.addEventListener('resize', fitFlip);

async function init() {
  load(); applyTheme();
  TH.onSystemChange(() => { applyTheme(); if (screen === 'more') renderMore(); });
  screen = state.onboarded ? 'home' : 'onboarding';
  render();
  if (!isNative) return;
  if (state.onboarded) { await ensurePermission(false); await scheduleReminders(); render(); }
  if (LN) LN.addListener('localNotificationActionPerformed', () => { if (!state.onboarded) return; if (todayQ().length) startSession(''); else go('home'); });
  if (App) App.addListener('backButton', () => {
    if (viewer) closeViewer();
    else if (menuOpen) { menuOpen = false; $('layer2').innerHTML = ''; }
    else if (sheet) closeSheet();
    else if (screen === 'review') { session = null; go('home'); }
    else if (screen === 'onboarding') { if (onbStep > 0) { onbStep--; renderOnboarding(); } else App.exitApp(); }
    else if (screen !== 'home') go('home');
    else App.exitApp();
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    await ensurePermission(false); scheduleReminders();
    if (!sheet && (screen === 'home' || screen === 'more' || screen === 'cal')) render();
  });
}
init();
})();
