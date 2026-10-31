/* Turns a Coach_Training_Load.xlsx into report data (the numbers the client page draws). */
(function () {
  const num = v => {
    if (typeof v === "number") return v;
    if (typeof v === "string") { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; }
    return 0;
  };

  function parseCoachFile(wb) {
    const weekNames = wb.names.filter(n => /^Week \d+$/.test(n)).sort((a, b) => +a.split(" ")[1] - +b.split(" ")[1]);
    if (!weekNames.length) throw new Error("No 'Week 1', 'Week 2'… tabs found. Use the Coach Training Load file.");
    const card = wb.sheet("Cardio"), bw = card ? num(card.get(8, 3)) : 0;
    const sum = wb.sheet("Summary");
    let client = "";
    if (sum && typeof sum.get(1, 1) === "string" && sum.get(1, 1).includes("|")) client = sum.get(1, 1).split("|").pop().trim();
    const phases = {};
    const st = wb.sheet("Settings");
    if (st) for (let r = 1; r <= Math.min(st.maxRow, 40); r++) {
      const w = st.get(r, 2);
      if (typeof w === "string" && /^Week \d+$/.test(w) && st.get(r, 3)) phases[+w.split(" ")[1]] = String(st.get(r, 3));
    }

    const rows = [], dayTitles = {};
    for (const wn of weekNames) {
      const wk = +wn.split(" ")[1], ws = wb.sheet(wn);
      let day = 0;
      for (let r = 1; r <= ws.maxRow; r++) {
        const a = ws.get(r, 1), b = ws.get(r, 2);
        if (typeof a === "string" && /^DAY\s*\d+/i.test(a)) {
          day = parseInt(a.replace(/\D+/, ""), 10);
          if (!dayTitles[day]) dayTitles[day] = a.split(/[—-]/).slice(1).join("—").split("|")[0].trim();
          continue;
        }
        if (typeof a !== "number" || typeof b !== "string" || !b.trim() || !day) continue;
        const typ = ws.get(r, 5) || "Reps", useBW = ws.get(r, 9) === "Yes", sides = num(ws.get(r, 14)) || 1;
        const reps = [16, 18, 20, 22].map(c => num(ws.get(r, c)));
        const kg = [0, 1, 2, 3].map(i => { const h = ws.get(r, 30 + i); return h !== null ? num(h) : num(ws.get(r, 15 + 2 * i)); });
        const timed = typ === "Sec" || typ === "Meters";
        const vol = timed ? 0 : reps.reduce((s, x, i) => s + (kg[i] + (useBW ? bw : 0)) * x, 0) * sides;
        rows.push({
          wk, day, name: b.trim(), muscle: ws.get(r, 3) || "", plan: num(ws.get(r, 10)), sets: reps.filter(x => x > 0).length,
          reps: timed ? 0 : reps.reduce((s, x) => s + x, 0) * sides, rawReps: reps.reduce((s, x) => s + x, 0),
          top: Math.max(...kg.map((k, i) => reps[i] > 0 ? k : 0)), vol: Math.round(vol * 10) / 10, useBW, timed
        });
      }
    }
    const weeksAll = weekNames.map(n => +n.split(" ")[1]);
    const weeks = weeksAll.map(w => {
      const R = rows.filter(x => x.wk === w);
      return { w, phase: phases[w] || "", vol: Math.round(R.reduce((s, x) => s + x.vol, 0)), reps: R.reduce((s, x) => s + x.reps, 0),
        plan: R.reduce((s, x) => s + x.plan, 0), done: R.reduce((s, x) => s + x.sets, 0) };
    }).map(w => ({ ...w, logged: w.done > 0 }));
    const days = [...new Set(rows.map(x => x.day))].sort((a, b) => a - b).map(d => ({
      d, title: dayTitles[d] || "", vol: weeksAll.map(w => Math.round(rows.filter(x => x.wk === w && x.day === d).reduce((s, x) => s + x.vol, 0)))
    }));
    const exMap = new Map();
    rows.forEach(x => {
      const k = x.day + "|" + x.name;
      if (!exMap.has(k)) exMap.set(k, { day: x.day, name: x.name, muscle: x.muscle, useBW: x.useBW, timed: x.timed, w: {} });
      exMap.get(k).w[x.wk] = { top: x.top, sets: x.sets, plan: x.plan, reps: x.rawReps, vol: x.vol };
    });
    const logged = weeks.filter(w => w.logged).map(w => w.w);
    const mus = {};
    rows.filter(x => logged.includes(x.wk) && x.muscle).forEach(x => {
      mus[x.muscle] = mus[x.muscle] || { m: x.muscle, plan: 0, done: 0 };
      mus[x.muscle].plan += x.plan; mus[x.muscle].done += x.sets;
    });
    return { client, bw, weeks, days, ex: [...exMap.values()], muscles: Object.values(mus).filter(m => m.plan > 0) };
  }
  window.parseCoachFile = parseCoachFile;
})();
