// Модель памяти: заряд карточек, личная кривая забывания, готовность к экзамену, лучшее время, помощник зацепок.
(() => {
  const S = window.SCHED;
  // Кривая Эббингауза (1885): доля сохранённого (метод сбережения) без повторений, по дням
  const EBB = [[0.014, 58.2], [0.042, 44.2], [0.375, 35.8], [1, 33.7], [2, 27.8], [6, 25.4], [31, 21.1]];

  // Стабильность (дней): при t = S вероятность вспомнить ≈ 90%
  function stability(c) {
    if (c.fresh) return 0;
    if (c.mode === 'plan') return Math.max(1, c.interval || 1);
    return c.interval > 0 ? c.interval : 0.4;
  }
  const lastOf = c => c.last != null ? c.last : c.due - (c.interval || 0);
  // Степенная кривая забывания (как в FSRS): R(t) = (1 + t / 9S)^-1
  function Rt(t, Sd) { if (Sd <= 0) return 0; return Math.pow(1 + Math.max(0, t) / (9 * Sd), -1); }
  function R(c, day) { if (c.fresh) return 0; if (c.archived) return 1; return Rt(day - lastOf(c), stability(c)); }

  function memoryNow(cards, day, deck) {
    const xs = cards.filter(c => !c.archived && !c.fresh && (!deck || c.deck === deck));
    if (!xs.length) return null;
    return xs.reduce((s, c) => s + R(c, day), 0) / xs.length;
  }

  // Готовность к экзамену: прогноз, если повторять в срок, и если остановиться сейчас
  function readiness(cards, deck, exam, today) {
    const xs = cards.filter(c => !c.archived && c.deck === deck);
    if (!xs.length || exam <= today) return null;
    let withPlan = 0, stop = 0, notStarted = 0;
    for (const c of xs) {
      stop += c.fresh ? 0 : R(c, exam);
      // моделируем повторения до экзамена, считая ответы успешными
      let sim = { ...c, plan: c.plan ? { ...c.plan } : undefined }, day = c.due, guard = 0;
      if (sim.fresh && day >= exam) { notStarted++; continue; }
      while (day < exam && guard++ < 60) {
        const T = Math.max(day, today);
        if (sim.mode === 'plan') {
          const n = S.planNext(sim, T);
          if (n.finished) { sim = { ...sim, fresh: false, last: T, interval: Math.max(1, exam - T) }; break; }
          sim = { ...sim, fresh: false, last: T, step: n.step, interval: n.interval, due: n.due };
          if (n.switchToClassic) sim.plan = { kind: 'classic' };
          day = n.due;
        } else {
          const r = S.sm2(sim, 4);
          sim = { ...sim, ...r, fresh: false, last: T, due: T + r.interval };
          day = sim.due;
        }
      }
      withPlan += R(sim, exam);
    }
    return { withPlan: withPlan / xs.length, stop: stop / xs.length, now: memoryNow(cards, today, deck) || 0, notStarted, total: xs.length, days: exam - today };
  }

  // Личная кривая: доля «вспомнил» в зависимости от дней с прошлого повторения
  const BINS = [[1, 1, '1 д'], [2, 3, '2–3'], [4, 7, '4–7'], [8, 14, '1–2 нед'], [15, 30, '2–4 нед'], [31, 90, '1–3 мес'], [91, 99999, '3+ мес']];
  function personalCurve(hist, deck) {
    const byCard = new Map();
    for (const h of hist) { if (deck && h.k !== deck) continue; if (!byCard.has(h.id)) byCard.set(h.id, []); byCard.get(h.id).push(h); }
    const acc = BINS.map(() => ({ ok: 0, n: 0 }));
    for (const list of byCard.values()) {
      list.sort((a, b) => a.d - b.d || (a.m || 0) - (b.m || 0));
      for (let i = 1; i < list.length; i++) {
        const h = list[i]; if (h.g === 'p') continue;
        const gap = h.d - list[i - 1].d; if (gap < 1) continue;
        const bi = BINS.findIndex(([a, b]) => gap >= a && gap <= b); if (bi < 0) continue;
        acc[bi].n++; if (h.g >= 3) acc[bi].ok++;
      }
    }
    return BINS.map(([a, b, label], i) => ({ label, mid: Math.min(b, a === b ? a : Math.round(Math.sqrt(a * Math.min(b, 180)))), n: acc[i].n, p: acc[i].n ? acc[i].ok / acc[i].n : null }));
  }

  // Лучшее время дня
  const PARTS = [['morning', 'Утро', 5 * 60, 12 * 60], ['day', 'День', 12 * 60, 17 * 60], ['evening', 'Вечер', 17 * 60, 22 * 60], ['night', 'Ночь', 22 * 60, 29 * 60]];
  const partOf = m => { const x = m < 5 * 60 ? m + 24 * 60 : m; return PARTS.find(p => x >= p[2] && x < p[3]); };
  function bestTime(hist, remindTime) {
    const acc = Object.fromEntries(PARTS.map(p => [p[0], { ok: 0, n: 0, sumM: 0 }]));
    for (const h of hist) { if (h.m == null || h.g === 'p') continue; const p = partOf(h.m); const a = acc[p[0]]; a.n++; a.sumM += h.m; if (h.g >= 3) a.ok++; }
    const rows = PARTS.map(p => ({ key: p[0], name: p[1], n: acc[p[0]].n, p: acc[p[0]].n ? acc[p[0]].ok / acc[p[0]].n : null, avgM: acc[p[0]].n ? acc[p[0]].sumM / acc[p[0]].n : null }));
    const total = rows.reduce((s, r) => s + r.n, 0);
    const ok = rows.filter(r => r.n >= 10);
    let suggestion = null;
    if (total >= 30 && ok.length >= 2) {
      const best = ok.reduce((a, b) => b.p > a.p ? b : a);
      const [hh, mm] = (remindTime || '19:00').split(':').map(Number);
      const cur = rows.find(r => r.key === partOf(hh * 60 + mm)[0]);
      if (best.key !== cur.key && (cur.p == null || best.p - cur.p >= 0.07)) {
        let m = Math.round(best.avgM / 30) * 30 % (24 * 60);
        suggestion = { part: best.name, time: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), gain: cur.p == null ? null : Math.round((best.p - cur.p) * 100), bestP: best.p };
      }
    }
    return { rows, total, suggestion };
  }

  // Помощник зацепок
  function acronym(text) {
    const words = String(text).replace(/[«»"()\[\],.;:!?—–-]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !/^(и|в|во|на|с|со|к|по|из|от|до|за|для|не|а|но|the|of|and|a|an|to|in)$/i.test(w));
    if (words.length < 2) return null;
    return words.slice(0, 8).map(w => w[0].toUpperCase()).join('');
  }
  function numberHint(text) {
    const m = String(text).match(/\d{3,}/); if (!m) return null;
    const s = m[0], parts = s.length === 4 ? [s.slice(0, 2), s.slice(2)] : s.match(/.{1,3}/g);
    return parts.join(' | ');
  }
  window.MEMORY = { EBB, R, Rt, stability, memoryNow, readiness, personalCurve, bestTime, acronym, numberHint, partOf };
})();
