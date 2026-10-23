// Расписание: SM-2, планы «По плану», допуски, выравнивание нагрузки и прогноз с лимитами колод.
(() => {
  const CLASSIC = [1, 3, 7, 14, 30, 60, 120, 240, 365, 730, 1460, 2920, 5840];
  const DEFAULT_LIMIT = 15;
  const HORIZON = 120;          // на сколько дней вперёд выравнивать нагрузку

  // Интервал k-го шага: после конца списка каждый следующий вдвое длиннее
  function stepInterval(steps, k) {
    if (k < steps.length) return steps[k];
    return steps[steps.length - 1] * Math.pow(2, k - steps.length + 1);
  }
  const planSteps = plan => plan.kind === 'custom' && plan.steps && plan.steps.length ? plan.steps : CLASSIC;

  // Даты повторений к экзамену: интервалы растут, последнее — за день до экзамена
  function examDates(start, exam) {
    const D = exam - start;
    if (D <= 1) return [];
    const n = Math.max(1, Math.min(8, Math.round(Math.log2(D)) + 1));
    const out = [];
    for (let k = 1; k <= n; k++) {
      const o = Math.round((D - 1) * (Math.pow(2, k) - 1) / (Math.pow(2, n) - 1));
      if (o > 0 && !out.includes(start + o)) out.push(start + o);
    }
    return out;
  }

  // Допуск: насколько дней можно сдвинуть карточку без вреда
  function tol(interval, mode) {
    if (interval <= 2) return 0;
    if (mode === 'plan') return 1;
    return Math.max(1, Math.round(interval * 0.1));
  }

  // SM-2: возвращает новые поля (без выбора дня)
  function sm2(c, q) {
    const r = { reps: c.reps, interval: c.interval, ease: c.ease };
    if (q < 3) { r.reps = 0; r.interval = 0; }
    else {
      r.interval = r.reps === 0 ? 1 : r.reps === 1 ? 6 : Math.round(r.interval * r.ease);
      if (q === 3 && r.reps >= 2) r.interval = Math.max(1, Math.round(r.interval * 0.6));
      r.reps++;
    }
    r.ease = Math.max(1.3, +(r.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)).toFixed(2));
    return r;
  }

  // Следующий шаг плана после повторения в день T. Возвращает {due, step, interval, finished}
  function planNext(c, T) {
    const p = c.plan;
    if (p.kind === 'exam') {
      const nx = (p.dates || []).filter(d => d > T).sort((a, b) => a - b)[0];
      if (nx !== undefined) return { due: nx, step: c.step + 1, interval: nx - T };
      if (p.after === 'continue') {
        const gap = c.last != null ? Math.max(1, T - c.last) : 1;
        let k = 0; while (CLASSIC[k] !== undefined && CLASSIC[k] < Math.max(gap * 2, 7)) k++;
        return { due: T + stepInterval(CLASSIC, k), step: k + 1, interval: stepInterval(CLASSIC, k), switchToClassic: true };
      }
      return { finished: true };
    }
    const I = stepInterval(planSteps(p), c.step);
    return { due: T + I, step: c.step + 1, interval: I };
  }

  // Будущие даты плана после текущего due (если повторять точно в срок), до дня until
  function chain(c, until, max = 40) {
    if (c.mode !== 'plan' || c.archived) return [];
    const out = []; let sim = { ...c, plan: { ...c.plan } }, T = c.due;
    for (let i = 0; i < max; i++) {
      const n = planNext(sim, T);
      if (n.finished || n.due > until) break;
      out.push(n.due);
      sim = { ...sim, step: n.step, last: T };
      if (n.switchToClassic) sim.plan = { kind: 'classic' };
      T = n.due;
    }
    return out;
  }

  // Нагрузка по дням для колоды
  function loadMap(cards, deck) {
    const m = new Map();
    for (const c of cards) if (!c.archived && c.deck === deck) m.set(c.due, (m.get(c.due) || 0) + 1);
    return m;
  }

  // Выбор дня в пределах допуска: где меньше всего карточек; при равенстве ближе к сроку, раньше лучше
  function pickDay(nominal, interval, mode, deck, cards, today, skipId) {
    const t = tol(interval, mode);
    if (!t) return nominal;
    const m = loadMap(cards.filter(c => c.id !== skipId), deck);
    let best = nominal, bestLoad = Infinity;
    const cands = [];
    for (let d = nominal - t; d <= nominal + t; d++) if (d > today) cands.push(d);
    cands.sort((a, b) => Math.abs(a - nominal) - Math.abs(b - nominal) || a - b);
    for (const d of cands) { const l = m.get(d) || 0; if (l < bestLoad) { bestLoad = l; best = d; } }
    return best;
  }

  // Выравнивание: только для дней сверх лимита. Карточки уходят в соседние дни в пределах допуска,
  // пока перенос делает дни ровнее (16 и 0 → 8 и 8).
  function rebalance(cards, limitOf, today) {
    let moved = 0;
    const decks = [...new Set(cards.filter(c => !c.archived).map(c => c.deck))];
    for (const deck of decks) {
      const L = limitOf(deck);
      const dc = cards.filter(c => !c.archived && c.deck === deck);
      const load = new Map(); dc.forEach(c => load.set(c.due, (load.get(c.due) || 0) + 1));
      for (let d = today + 1; d <= today + HORIZON; d++) {
        if ((load.get(d) || 0) <= L) continue;
        for (let guard = 0; guard < 500; guard++) {
          const here = load.get(d) || 0;
          let best = null;
          for (const c of dc) {
            if (c.due !== d || c.pin || c.fresh) continue;
            const iv = c.mode === 'plan' ? Math.max(c.interval || 0, 0) : c.interval;
            const t = tol(iv, c.mode); if (!t) continue;
            const nom = c.nom != null ? c.nom : c.due;
            for (let x = nom - t; x <= nom + t; x++) {
              if (x <= today || x === d) continue;
              const l = load.get(x) || 0;
              const score = l * 100 + Math.abs(x - nom) * 2 + (x > nom ? 1 : 0);
              if (!best || score < best.score) best = { c, x, l, score };
            }
          }
          if (!best || best.l + 1 >= here) break;
          load.set(d, here - 1); load.set(best.x, best.l + 1);
          best.c.due = best.x; moved++;
        }
      }
    }
    return moved;
  }

  // Приоритет в очереди дня: просроченные и с коротким интервалом раньше, новые — последними
  const prio = (a, b) => (a.fresh ? 1 : 0) - (b.fresh ? 1 : 0) || a.due - b.due || (a.interval || 0) - (b.interval || 0);

  // Прогноз с лимитами: что реально попадёт в каждый день с сегодня до until
  function forecast(cards, limitOf, today, until, hist) {
    const days = new Map();        // d -> [{c, carried}]
    const backlogEnd = {};         // колода -> последний день, когда ещё есть перенос
    const decks = [...new Set(cards.filter(c => !c.archived).map(c => c.deck))];
    for (const deck of decks) {
      const L = limitOf(deck);
      const dc = cards.filter(c => !c.archived && c.deck === deck);
      const byDay = new Map(); let maxDue = today;
      for (const c of dc) if (c.due > today) { if (!byDay.has(c.due)) byDay.set(c.due, []); byDay.get(c.due).push(c); maxDue = Math.max(maxDue, c.due); }
      const doneIds = new Set(hist.filter(h => h.d === today && h.k === deck).map(h => h.id));
      const dueNow = dc.filter(c => c.due <= today);
      const relearn = dueNow.filter(c => doneIds.has(c.id));
      const others = dueNow.filter(c => !doneIds.has(c.id)).sort(prio);
      const slots = Math.max(0, L - doneIds.size);
      const todayList = [...relearn, ...others.slice(0, slots)];
      let carry = others.slice(slots);
      push(days, today, todayList.map(c => ({ c, carried: c.due < today })));
      const end = Math.max(until, carry.length ? today + 400 : today);
      for (let d = today + 1; d <= end; d++) {
        if (d > until && !carry.length) break;
        if (d > maxDue && !carry.length && d > until) break;
        const cand = [...carry, ...(byDay.get(d) || [])].sort(prio);
        const take = cand.slice(0, L); carry = cand.slice(L);
        if (d <= until && take.length) push(days, d, take.map(c => ({ c, carried: c.due < d })));
        if (carry.length) backlogEnd[deck] = d;
      }
      if (carry.length === 0 && others.length > slots && backlogEnd[deck] === undefined) backlogEnd[deck] = today;
    }
    return { days, backlogEnd };
  }
  function push(m, d, arr) { if (!arr.length) return; if (!m.has(d)) m.set(d, []); m.get(d).push(...arr); }

  window.SCHED = { CLASSIC, DEFAULT_LIMIT, stepInterval, planSteps, examDates, tol, sm2, planNext, chain, pickDay, rebalance, forecast, prio };
})();
