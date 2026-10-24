// Звёздное небо памяти: каждая карточка — звезда, колода — созвездие. Яркость = заряд памяти.
(() => {
  const STAR = ['#8ea0ff', '#62c586', '#f0a070', '#c49af0', '#5ccbd8', '#f07f8f', '#d9c84a', '#a5afc4'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rnd = (seed, k) => ((hash(seed + ':' + k) % 100000) / 100000);

  // Раскладка: центры созвездий по эллипсу, звёзды — внутри круга созвездия
  function layout(cards, decks, w, h, full) {
    const n = decks.length, cx = w / 2, cy = h / 2;
    const rx = n > 1 ? w * (full ? 0.31 : 0.33) : 0, ry = n > 1 ? h * (full ? 0.27 : 0.24) : 0;
    const centers = {};
    decks.forEach((d, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2 + (rnd(d, 'a') - 0.5) * 0.5;
      centers[d] = { x: cx + Math.cos(a) * rx * (0.85 + rnd(d, 'r') * 0.3), y: cy + Math.sin(a) * ry * (0.85 + rnd(d, 'r2') * 0.3) };
    });
    const per = {}; cards.forEach(c => (per[c.deck] = per[c.deck] || []).push(c));
    const stars = [];
    for (const d of decks) {
      const list = per[d] || [], ctr = centers[d];
      const R = Math.min(w, h) * (n > 1 ? (full ? 0.15 : 0.13) : (full ? 0.36 : 0.32)) * Math.min(1, 0.45 + Math.sqrt(list.length) / 9);
      list.forEach(c => {
        const a = rnd(c.id, 'a') * Math.PI * 2, r = Math.sqrt(rnd(c.id, 'r')) * R;
        stars.push({ c, deck: d, x: Math.max(8, Math.min(w - 8, ctr.x + Math.cos(a) * r * 1.25)), y: Math.max(8, Math.min(h - 8, ctr.y + Math.sin(a) * r)), ph: rnd(c.id, 'p') * 6.28 });
      });
    }
    // линии созвездий: каждая звезда соединяется с ближайшей из уже соединённых
    const lines = [];
    for (const d of decks) {
      const ss = stars.filter(s => s.deck === d).sort((a, b) => (a.c.created || 0) - (b.c.created || 0) || hash(a.c.id) - hash(b.c.id));
      for (let i = 1; i < ss.length && i < 60; i++) {
        let best = null, bd = Infinity;
        for (let j = 0; j < i; j++) { const dx = ss[i].x - ss[j].x, dy = ss[i].y - ss[j].y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = ss[j]; } }
        lines.push([ss[i], best]);
      }
    }
    return { stars, lines, centers };
  }

  function create(canvas, opts) {
    const ctx = canvas.getContext('2d');
    let data = null, raf = 0, w = 0, h = 0, geo = null, bg = [];
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
      w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = Array.from({ length: Math.round(w * h / 1400) }, (_, i) => ({ x: rnd('bg', i) * w, y: rnd('bg', i + .5) * h, r: rnd('bg', i + .7) * 0.9 + 0.2, a: rnd('bg', i + .9) * 0.35 + 0.05 }));
      relayout();
    }
    function relayout() { if (data && w) geo = layout(data.cards, data.decks, w, h, opts.full); }
    function frame(t) {
      if (!w) return;
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, '#070b1a'); g.addColorStop(0.6, '#0e1430'); g.addColorStop(1, '#1a1840');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const s of bg) { ctx.globalAlpha = s.a; ctx.fillStyle = '#c9d2ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill(); }
      if (!geo) { ctx.globalAlpha = 1; return; }
      const tw = reduce.matches ? 0 : t / 1000;
      ctx.lineWidth = 1;
      for (const [a, b] of geo.lines) {
        const col = STAR[data.colorIdx(a.deck) % 8], al = Math.min(data.R(a.c), data.R(b.c));
        ctx.globalAlpha = 0.08 + 0.32 * al; ctx.strokeStyle = col;
        ctx.setLineDash(al < 0.3 ? [2, 4] : []);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const s of geo.stars) {
        const r = data.R(s.c), col = STAR[data.colorIdx(s.deck) % 8];
        const size = s.c.fresh ? 1.1 : 1.3 + 2.4 * Math.min(1, Math.log(1 + data.S(s.c)) / Math.log(400));
        const tw1 = 0.82 + 0.18 * Math.sin(tw * (1.2 + (s.ph % 1)) + s.ph);
        const a = s.c.fresh ? 0.28 : (0.18 + 0.82 * r) * tw1;
        if (!s.c.fresh && r > 0.5) {
          const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size * 5);
          rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = a * 0.45; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(s.x, s.y, size * 5, 0, 6.29); ctx.fill();
        }
        ctx.globalAlpha = a; ctx.fillStyle = r > 0.85 ? '#ffffff' : col;
        ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, 6.29); ctx.fill();
        if (s === opts.selected) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, size + 6, 0, 6.29); ctx.stroke(); }
      }
      if (opts.full) {
        ctx.font = '600 12px "Golos Text", system-ui, sans-serif'; ctx.textAlign = 'center';
        for (const d of data.decks) {
          const ctr = geo.centers[d], ys = geo.stars.filter(s => s.deck === d).map(s => s.y);
          const top = ys.length ? Math.min(...ys) : ctr.y;
          ctx.globalAlpha = 0.85; ctx.fillStyle = STAR[data.colorIdx(d) % 8];
          ctx.fillText(d.length > 22 ? d.slice(0, 21) + '…' : d, ctr.x, Math.max(16, top - 12));
        }
      }
      ctx.globalAlpha = 1;
    }
    let lastT = 0;
    function loop(t) { if (!document.hidden && t - lastT > 66) { frame(t); lastT = t; } if (!reduce.matches && document.body.contains(canvas)) raf = requestAnimationFrame(loop); else raf = 0; }
    const ro = new ResizeObserver(() => { resize(); frame(performance.now()); });
    ro.observe(canvas);
    return {
      set(d) { data = d; relayout(); frame(performance.now()); if (!raf) raf = requestAnimationFrame(loop); },
      hit(x, y) { if (!geo) return null; let best = null, bd = 24 * 24; for (const s of geo.stars) { const dd = (s.x - x) ** 2 + (s.y - y) ** 2; if (dd < bd) { bd = dd; best = s; } } return best; },
      select(s) { opts.selected = s; frame(performance.now()); },
      stop() { cancelAnimationFrame(raf); raf = 0; ro.disconnect(); },
    };
  }
  window.SKY = { create, STAR };
})();
