/* Draws a client's report from its data. Works for any number of days and weeks, in every site language. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const t = (k, v) => window.I18N.t(k, v), mu = m => window.I18N.mus(m);
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const pct = (a, b) => b ? (a - b) / b * 100 : 0;
  const sgn = v => (v > 0 ? "+" : "") + Math.round(v) + "%";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = (tg, a = {}, p) => { const e = document.createElementNS(NS, tg); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const svgRoot = (host, w, h, label) => el("svg", { class: "chart", viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }, host);
  const roundTop = (x, y, w, h, r = 4) => { if (h <= 0) return ""; r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const roundRight = (x, y, w, h, r = 4) => { if (w <= 0) return ""; r = Math.min(r, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; };

  function tipper() {
    const tip = document.getElementById("tip");
    return (g, html) => {
      g.setAttribute("tabindex", "0"); g.classList.add("hit");
      const show = (x, y) => { tip.innerHTML = html; tip.style.opacity = 1; const r = tip.getBoundingClientRect();
        let L = x + 14, T = y - r.height - 10; if (L + r.width > innerWidth - 8) L = x - r.width - 14; if (L < 8) L = 8; if (T < 8) T = y + 16;
        tip.style.left = L + "px"; tip.style.top = T + "px"; };
      g.addEventListener("mousemove", e => show(e.clientX, e.clientY));
      g.addEventListener("mouseleave", () => tip.style.opacity = 0);
      g.addEventListener("focus", () => { const b = g.getBoundingClientRect(); show(b.left + b.width / 2, b.top); });
      g.addEventListener("blur", () => tip.style.opacity = 0);
    };
  }

  function render(root, R, onClose) {
    const bind = tipper();
    const L = R.weeks.filter(w => w.logged), F = L[0], Z = L[L.length - 1], multi = L.length > 1;
    const wcol = i => `var(--w${Math.min(4, Math.max(1, 4 - (L.length - 1) + i))})`;
    const exs = R.ex, W = n => t("week", { n });
    const coachName = t("coach");

    const STR = [], odd = [];
    if (multi) exs.forEach(e => {
      const a = e.w[F.w], b = e.w[Z.w];
      if (!a || !b || !a.sets || !b.sets || e.timed) return;
      const bw = e.useBW && !a.top && !b.top;
      if (!bw && (!a.top || !b.top)) return;
      const x = bw ? a.reps : a.top, y = bw ? b.reps : b.top, r = y / x;
      if (r >= 2.5 || r <= 0.6) { odd.push(`${e.name} (${x} → ${y} kg)`); return; }
      STR.push({ n: e.name, d: e.day, a: x, b: y, bw, ch: pct(y, x), ra: a.reps, rb: b.reps });
    });
    STR.sort((p, q) => q.ch - p.ch);
    const totVol = L.reduce((s, w) => s + w.vol, 0), totReps = L.reduce((s, w) => s + w.reps, 0);
    const plan = L.reduce((s, w) => s + w.plan, 0), done = L.reduce((s, w) => s + w.done, 0);
    const heavier = STR.filter(s => s.ch > 0).length;
    const volCh = multi ? pct(Z.vol, F.vol) : 0;
    const comp = L.map(w => w.plan ? w.done / w.plan : 0);
    const skipped = exs.filter(e => L.every(w => !e.w[w.w] || !e.w[w.w].sets) && L.some(w => e.w[w.w] && e.w[w.w].plan > 0));
    const zeroMus = R.muscles.filter(m => m.done === 0);
    const unlogged = R.weeks.filter(w => !w.logged);
    const range = multi ? t("weeks", { a: F.w, b: Z.w }) : t("week1", { a: F.w });

    const wm = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='340' height='200'><text x='20' y='110' transform='rotate(-24 170 100)' font-family='Arial' font-size='22' font-weight='700' fill='#000'>${esc(R.client)} · ${esc(window.SITE.coachFirst)} ${esc(window.SITE.coachLast)}</text></svg>`);
    const idx = (n, k) => `<span class="idx">0${n} · ${t(k)}</span>`;

    root.innerHTML = `
    <div class="watermark" style="background-image:url(&quot;data:image/svg+xml;utf8,${wm}&quot;)"></div>
    <div class="wrap">
      <button class="closebtn" id="closeR" type="button">${t("close")}</button>
      <section class="top">
        <div>
          <div class="eyebrow">${esc(t("eyebrow", { name: coachName }))}</div>
          <h1>${esc(R.client)}${R.label ? ` <span>·</span> ${esc(R.label)}` : ""}</h1>
          <div class="meta">${R.days.length ? `<span>${t("daysWeek", { n: R.days.length })}</span>` : ""}<span>${t("logged", { range })}</span>${R.subtitle ? `<span>${esc(R.subtitle)}</span>` : ""}${R.date ? `<span>${t("updated", { d: esc(R.date) })}</span>` : ""}</div>
        </div>
        <div class="weeks" aria-label="${t("weeks", { a: R.weeks[0].w, b: R.weeks[R.weeks.length - 1].w })}">${R.weeks.map(w => `<div class="wk ${w.logged ? "on" : "off"}"><b>${w.w}</b><small>${w.logged ? t("done") : "—"}</small></div>`).join("")}</div>
      </section>
      <section class="kpis" id="kpis"></section>
      <section class="grid2">
        <article class="panel"><header>${idx(1, "iLoad")}<h2 id="hVol"></h2><p>${t("pVol")}</p></header>
          <div id="cVol"></div>${unlogged.length ? `<p class="note">${t("empty", { list: unlogged.map(w => W(w.w)).join(", ") })}${R.emptyNote ? " " + esc(R.emptyNote) + "." : ""}</p>` : ""}</article>
        <article class="panel"><header>${idx(2, "iDone")}<h2 id="hDone"></h2><p>${t("pDone")}</p></header><div id="cDone"></div></article>
      </section>
      ${R.days.length ? `<article class="panel"><header>${idx(3, "iDay")}<h2>${t("hDays")}</h2><p>${t("pDays", { range })}</p></header>
        <div class="legend" aria-hidden="true">${L.map((w, i) => `<span><i style="background:${wcol(i)}"></i>${W(w.w)}</span>`).join("")}</div><div class="days" id="cDays"></div></article>` : ""}
      <section class="grid2">
        ${STR.length ? `<article class="panel"><header>${idx(4, "iStr")}<h2>${heavier >= STR.length * 0.7 ? t("hStrAll") : t("hStr")}</h2>
          <p>${t("pStr", { a: F.w, b: Z.w })}</p></header><div id="cStr"></div>
          ${odd.length ? `<p class="note">${esc(t("odd", { list: odd.join(", ") }))}</p>` : ""}</article>` : ""}
        <article class="panel"><header>${idx(5, "iMus")}<h2>${zeroMus.length ? (zeroMus.length === 1 ? t("hMus1") : t("hMusN", { n: zeroMus.length })) : t("hMusAll")}</h2>
          <p>${t("pMus", { range })}</p></header>
          <div class="legend" aria-hidden="true"><span><i style="background:var(--accent)"></i>${t("legDone")}</span><span><i style="background:var(--line)"></i>${t("legNot")}</span></div><div id="cMus"></div></article>
      </section>
      ${skipped.length || (R.notes && R.notes.length) ? `<article class="panel"><header>${idx(6, "iNext")}<h2>${skipped.length ? t("hSkip") : t("hNotes")}</h2>
        ${skipped.length ? `<p>${t("pSkip", { range })}</p>` : ""}</header>
        ${skipped.length ? `<div class="skips">${skipped.map(e => `<div class="skip"><b dir="ltr">${esc(e.name)}</b><span>${t("dayW", { n: e.day })} · ${esc(mu(e.muscle))}</span></div>`).join("")}</div>` : ""}
        ${R.notes && R.notes.length ? `<div class="fix" dir="ltr"><h3>${esc(R.notesTitle || t("hNotes"))}</h3><ul>${R.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}</article>` : ""}
      <article class="panel"><header>${idx(7, "iDet")}<h2>${t("hDet")}</h2><p>${t("pDet")}</p></header>
        <div class="tablebox"><table id="tbl"></table></div></article>
    </div>`;
    root.querySelector("#closeR").addEventListener("click", onClose);

    /* KPIs */
    const kp = [
      [t("kVol"), fmt(totVol), "kg", range, ""],
      multi ? [t("kVolCh", { a: F.w, b: Z.w }), sgn(volCh), "", `${fmt(F.vol)} → ${fmt(Z.vol)} kg`, volCh >= 0 ? "good" : "crit"] : [t("kVolSess"), fmt(F.vol / Math.max(1, R.days.length)), "kg", t("avg"), ""],
      [t("kReps"), fmt(totReps), "", L.map(w => fmt(w.reps)).join(" · "), ""],
      [t("kSets"), plan ? Math.round(done / plan * 100) : 0, "%", t("kSetsSub", { d: done, p: plan }), done / plan >= 0.85 ? "good" : "warn"],
      STR.length ? [t("kHeavier"), heavier, `/ ${STR.length}`, t("kHeavierSub", { a: F.w, b: Z.w }), heavier >= STR.length / 2 ? "good" : "warn"] : [t("kEx"), exs.length, "", t("kExSub"), ""],
    ];
    root.querySelector("#kpis").innerHTML = kp.map(([l, v, u, s, c]) => `<div class="kpi"><span class="lab">${l}</span><span class="val num" dir="ltr">${v}<small>${u}</small></span><span class="sub">${c ? `<span class="chip ${c}">${t(c)}</span> ` : ""}<bdi>${s}</bdi></span></div>`).join("");

    /* 01 volume per week */
    (function () {
      const up = L.every((w, i) => !i || w.vol >= L[i - 1].vol);
      root.querySelector("#hVol").textContent = !multi ? t("hVolOne") : up ? t("hVolUp") : t(volCh >= 0 ? "hVolUpBy" : "hVolDownBy", { x: Math.abs(Math.round(volCh)) });
      const host = root.querySelector("#cVol"), N = R.weeks.length, w = 520, h = 260, m = { l: 52, r: 10, t: 34, b: 30 };
      const max = niceMax(Math.max(...R.weeks.map(x => x.vol)) * 1.12), iw = w - m.l - m.r, ih = h - m.t - m.b, y = v => m.t + ih - v / max * ih;
      const s = svgRoot(host, w, h, t("kVol") + ": " + L.map(x => `${W(x.w)} ${fmt(x.vol)} kg`).join(", "));
      for (let k = 0; k <= 5; k++) { const v = max / 5 * k;
        el("line", { x1: m.l, x2: w - m.r, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-dasharray": k ? "2 4" : "" }, s);
        el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11 }, s).textContent = v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v; }
      const bw = Math.min(70, iw / N * 0.56);
      R.weeks.forEach((d, i) => {
        const cx = m.l + iw / N * (i + .5), x = cx - bw / 2;
        el("text", { x: cx, y: h - 8, "text-anchor": "middle", "font-size": 12, "font-weight": 600 }, s).textContent = W(d.w);
        if (!d.logged) { el("rect", { x, y: m.t + ih * .2, width: bw, height: ih * .8, rx: 4, fill: "none", stroke: "var(--line)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
          el("text", { x: cx, y: m.t + ih * .6, "text-anchor": "middle", "font-size": 11, style: "fill:var(--muted)" }, s).textContent = t("notLogged"); return; }
        const g = el("g", {}, s);
        el("path", { class: "mk", d: roundTop(x, y(d.vol), bw, m.t + ih - y(d.vol)), fill: d === Z ? "var(--accent)" : "var(--w1)" }, g);
        el("text", { x: cx, y: y(d.vol) - 8, "text-anchor": "middle", "font-size": 13, "font-weight": 600, style: "fill:var(--ink)" }, g).textContent = fmt(d.vol);
        const pi = L.indexOf(d), prev = pi > 0 ? L[pi - 1] : null;
        bind(g, `<b>${W(d.w)}</b>${d.phase ? " · " + esc(d.phase) : ""}<br>${t("tVol", { v: fmt(d.vol) })}<br>${t("tRepsSets", { r: fmt(d.reps), d: d.done, p: d.plan })}${prev ? `<br>${t("tVs", { c: sgn(pct(d.vol, prev.vol)), w: prev.w })}` : ""}`);
        if (prev && R.weeks.indexOf(prev) === i - 1) {
          const c = pct(d.vol, prev.vol), mx = m.l + iw / N * i, ym = y(Math.max(d.vol, prev.vol)) - 26;
          el("text", { x: mx, y: ym, "text-anchor": "middle", "font-size": 11.5, "font-weight": 600, style: `fill:${c >= 0 ? "var(--good)" : "var(--crit)"}` }, s).textContent = (c >= 0 ? "▲ " : "▼ ") + sgn(c);
        }
      });
    })();

    /* 02 completion */
    (function () {
      const dropped = multi && comp[comp.length - 1] < comp[0] - 0.05;
      root.querySelector("#hDone").textContent = !multi ? t("hDoneOne") : dropped ? t("hDoneDrop") : t("hDoneOk");
      const host = root.querySelector("#cDone"), w = 440, rowH = 62, h = rowH * L.length + 10;
      const s = svgRoot(host, w, h, t("kSets"));
      const x0 = 78, iw = w - x0 - 60, max = Math.max(...L.map(x => x.plan)) * 1.06 || 1;
      L.forEach((d, i) => {
        const y = 14 + i * rowH, r = d.plan ? d.done / d.plan : 0, g = el("g", {}, s);
        el("text", { x: 0, y: y + 17, "font-size": 13, "font-weight": 600, style: "fill:var(--ink)" }, s).textContent = W(d.w);
        el("rect", { x: x0, y: y + 4, width: iw * d.plan / max, height: 18, rx: 4, fill: "var(--line)" }, g);
        el("path", { class: "mk", d: roundRight(x0, y + 4, iw * d.done / max - 1, 18), fill: "var(--accent)" }, g);
        el("text", { x: x0 + iw * d.plan / max + 8, y: y + 19, "font-size": 15, "font-weight": 700, "font-family": "Barlow Condensed, sans-serif", style: `fill:${r < .7 ? "var(--crit)" : r < .85 ? "var(--warn)" : "var(--good)"}` }, s).textContent = Math.round(r * 100) + "%";
        el("text", { x: x0, y: y + 40, "font-size": 11.5 }, s).textContent = t("doneLine", { d: d.done, m: d.plan - d.done, p: d.plan });
        bind(g, `<b>${W(d.w)}</b><br>${t("tDone", { d: d.done, p: d.plan })}<br>${t("tMissed", { m: d.plan - d.done })}`);
      });
    })();

    /* 03 by day */
    const dayHost = root.querySelector("#cDays");
    if (dayHost) {
      const allV = R.days.flatMap(dd => L.map(w => dd.vol[R.weeks.indexOf(w)]));
      const max = niceMax(Math.max(...allV) * 1.15);
      R.days.forEach(day => {
        const V = L.map(w => day.vol[R.weeks.indexOf(w)]), c = multi ? pct(V[V.length - 1], V[0]) : 0;
        const card = document.createElement("div"); card.className = "day";
        card.innerHTML = `<span class="d">${t("day", { n: day.d })}</span><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3 dir="ltr">${esc(day.title || t("dayW", { n: day.d }))}</h3>${multi ? `<span class="chip ${c >= 0 ? "good" : "crit"}" dir="ltr">${c >= 0 ? "▲" : "▼"} ${sgn(c)}</span>` : ""}</div>`;
        const w = 300, h = 150, m = { t: 20, b: 22 }, ih = h - m.t - m.b, y = v => m.t + ih - v / max * ih;
        const s = svgRoot(card, w, h, t("dayW", { n: day.d }));
        el("line", { x1: 0, x2: w, y1: y(0), y2: y(0), stroke: "var(--line)" }, s);
        const n = V.length, bw = Math.min(62, w / n * .6);
        V.forEach((v, i) => { const cx = w / n * (i + .5), g = el("g", {}, s);
          el("path", { class: "mk", d: roundTop(cx - bw / 2, y(v), bw, y(0) - y(v)), fill: wcol(i) }, g);
          el("text", { x: cx, y: y(v) - 6, "text-anchor": "middle", "font-size": 12, "font-weight": 600, style: "fill:var(--ink)" }, g).textContent = (v / 1000).toFixed(1) + "k";
          el("text", { x: cx, y: h - 5, "text-anchor": "middle", "font-size": 11 }, s).textContent = W(L[i].w);
          bind(g, `<b>${t("dayW", { n: day.d })} · ${W(L[i].w)}</b><br>${fmt(v)} kg${i ? `<br>${t("tVs", { c: sgn(pct(v, V[i - 1])), w: L[i - 1].w })}` : ""}`); });
        if (multi) {
          const dx = exs.filter(e => e.day === day.d).map(e => ({ e, a: e.w[F.w]?.vol || 0, b: e.w[Z.w]?.vol || 0, sb: e.w[Z.w]?.sets || 0 }));
          let why = "";
          if (c >= 0) { const g = dx.filter(x => x.b > x.a && x.a > 0).sort((p, q) => (q.b - q.a) - (p.b - p.a)).slice(0, 3).map(x => x.e.name);
            if (g.length) why = t("gains", { list: g.join(", ") }); }
          else { const l = dx.filter(x => x.a > x.b).sort((p, q) => (q.a - q.b) - (p.a - p.b)).slice(0, 2).map(x => x.sb === 0 ? t("notIn", { ex: x.e.name, w: Z.w }) : t("lighter", { ex: x.e.name, a: x.e.w[F.w].top, b: x.e.w[Z.w].top }));
            if (l.length) why = t("drop", { list: l.join("; ") }); }
          if (why) { const p = document.createElement("p"); p.className = "why"; p.textContent = why; card.appendChild(p); }
        }
        dayHost.appendChild(card);
      });
    }

    /* 04 strength */
    const sh = root.querySelector("#cStr");
    if (sh) {
      const rowH = 24, w = 520, x0 = 178, h = STR.length * rowH + 24;
      const s = svgRoot(sh, w, h, t("hStr"));
      const max = Math.max(25, niceMax(Math.max(...STR.map(d => d.ch)))), iw = w - x0 - 118, X = v => x0 + Math.max(0, v) / max * iw;
      [0, .25, .5, .75, 1].forEach(f => { const v = max * f; el("line", { x1: X(v), x2: X(v), y1: 4, y2: h - 18, stroke: "var(--line)", "stroke-dasharray": f ? "2 4" : "" }, s);
        el("text", { x: X(v), y: h - 4, "text-anchor": "middle", "font-size": 10.5 }, s).textContent = Math.round(v) + "%"; });
      STR.forEach((d, i) => {
        const y = 6 + i * rowH, g = el("g", {}, s), short = d.n.length > 26 ? d.n.slice(0, 25) + "…" : d.n;
        el("text", { x: x0 - 10, y: y + 12, "text-anchor": "end", "font-size": 12.5, style: "fill:var(--ink)" }, s).textContent = short + (d.bw ? " (reps)" : "");
        el("rect", { x: 0, y: y - 2, width: w, height: rowH - 2, fill: "transparent" }, g);
        if (d.ch > 0) el("path", { class: "mk", d: roundRight(x0, y + 3, X(d.ch) - x0, 13), fill: "var(--accent)" }, g);
        else el("circle", { class: "mk", cx: x0, cy: y + 9.5, r: 4, fill: d.ch < 0 ? "var(--crit)" : "var(--muted)" }, g);
        const unit = d.bw ? " reps" : " kg", uT = d.bw ? t("uReps") : t("uKg");
        el("text", { x: (d.ch > 0 ? X(d.ch) : x0) + 8, y: y + 13, "font-size": 12, "font-weight": 600, style: `fill:${d.ch > 0 ? "var(--ink)" : d.ch < 0 ? "var(--crit)" : "var(--muted)"}` }, g).textContent = `${sgn(d.ch)}  ·  ${d.a}→${d.b}${unit}`;
        bind(g, `<b>${esc(d.n)}</b> · ${t("dayW", { n: d.d })}<br>${t("tHeavy", { a: d.a, b: d.b, u: uT })}<br>${t("tReps", { a: d.ra, b: d.rb })}`);
      });
    }

    /* 05 muscles */
    (function () {
      const M = [...R.muscles].sort((a, b) => (a.done / a.plan) - (b.done / b.plan) || b.plan - a.plan);
      const host = root.querySelector("#cMus"), rowH = 26, w = 440, x0 = 112, h = M.length * rowH + 6;
      const s = svgRoot(host, w, h, t("pMus", { range }));
      const max = Math.max(...M.map(m => m.plan)) * 1.05 || 1, iw = w - x0 - 96;
      M.forEach((d, i) => {
        const y = 4 + i * rowH, r = d.done / d.plan, g = el("g", {}, s);
        el("text", { x: x0 - 10, y: y + 13, "text-anchor": "end", "font-size": 12.5, style: "fill:var(--ink)" }, s).textContent = mu(d.m);
        el("rect", { x: x0, y: y + 3, width: iw * d.plan / max, height: 14, rx: 3, fill: "var(--line)" }, g);
        if (d.done) el("path", { class: "mk", d: roundRight(x0, y + 3, iw * d.done / max - 1, 14, 3), fill: "var(--accent)" }, g);
        el("text", { x: x0 + iw * d.plan / max + 8, y: y + 14, "font-size": 12, "font-weight": 600, style: `fill:${r === 0 ? "var(--crit)" : r < .6 ? "var(--warn)" : "var(--ink-2)"}` }, g).textContent = r === 0 ? `${t("zeroOf", { p: d.plan })}  ✕` : `${d.done}/${d.plan} · ${Math.round(r * 100)}%`;
        bind(g, `<b>${esc(mu(d.m))}</b><br>${t("tMus", { d: d.done, p: d.plan })}`);
      });
    })();

    /* 07 table */
    (function () {
      const cols = L.map(w => w.w);
      const head = `<thead><tr><th>${t("thEx")}</th><th>${t("thMus")}</th>${cols.map(w => `<th>${t("thTop", { w })}</th>`).join("")}${cols.map(w => `<th>${t("thVol", { w })}</th>`).join("")}${multi ? `<th dir="ltr">W${F.w}→W${Z.w}</th>` : ""}</tr></thead>`;
      const cell = (e, w, k) => { const x = e.w[w]; if (!x || !x.sets) return `<td class="dim">—</td>`;
        if (k === "top") return `<td dir="ltr">${x.top ? x.top + " kg" : x.reps + (e.timed ? "" : " reps")}</td>`; return `<td>${x.vol ? fmt(x.vol) : "—"}</td>`; };
      const body = exs.map(e => { const a = e.w[F.w]?.vol || 0, b = e.w[Z.w]?.vol || 0, c = a && b ? pct(b, a) : null;
        return `<tr><td dir="ltr"><span class="daytag">D${e.day}</span>${esc(e.name)}</td><td>${esc(mu(e.muscle))}</td>${cols.map(w => cell(e, w, "top")).join("")}${cols.map(w => cell(e, w, "vol")).join("")}${multi ? `<td dir="ltr" class="${c === null ? "dim" : c > 0 ? "up" : c < 0 ? "down" : ""}">${c === null ? "—" : sgn(c)}</td>` : ""}</tr>`; }).join("");
      root.querySelector("#tbl").innerHTML = head + `<tbody>${body}</tbody>`;
    })();
  }
  window.Report = { render };
})();
