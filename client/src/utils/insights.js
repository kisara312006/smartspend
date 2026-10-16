import { monthBounds, shiftMonth } from "./dates";

// Everything here is plain arithmetic on the user's own expenses. No AI, no guessing.
const sum = (a) => a.reduce((t, r) => t + r.amount, 0);
const mean = (a) => (a.length ? sum(a.map((x) => ({ amount: x }))) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), i = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2) : 0; };
const group = (rows, fn) => rows.reduce((m, r) => { const k = fn(r); (m[k] = m[k] || []).push(r); return m; }, {});
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const pct = (now, prev) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);
const dayOf = (r) => Number(r.date.slice(8));

// rows: this user's expenses from 3 months before `month` up to the end of `month`.
export function analyze({ month, rows, todayISO, budget = 0, catBudgets = [], cur = "" }) {
  const m = (n) => `${cur} ${Math.round(n).toLocaleString()}`;
  const days = monthBounds(month).days;
  const isCurrent = month === todayISO.slice(0, 7);
  const cutoff = isCurrent ? Math.min(days, Number(todayISO.slice(8))) : days;
  const partial = isCurrent && cutoff < days;

  const prevKey = shiftMonth(month, -1);
  const now = rows.filter((r) => r.date.slice(0, 7) === month && dayOf(r) <= cutoff);
  const prev = rows.filter((r) => r.date.slice(0, 7) === prevKey && dayOf(r) <= cutoff);   // same days of last month
  const history = rows.filter((r) => { const k = r.date.slice(0, 7); return k < month && k >= shiftMonth(month, -3); });

  const base = { month, cur, partial, cutoffDay: cutoff, insights: [], notes: [], budget: null };
  if (now.length === 0) return { ...base, enough: false, total: 0, prevTotal: 0, count: 0, changePct: null, topCategory: null, largest: null, categories: [] };

  const total = sum(now), prevTotal = sum(prev), changePct = pct(total, prevTotal);
  const period = partial ? ` (first ${cutoff} days)` : "";
  const insights = [], notes = [];
  if (now.length < 5) notes.push(`Only ${now.length} expense${now.length > 1 ? "s" : ""} recorded this month, so the observations below are limited.`);

  // category totals
  const nowBy = group(now, (r) => r.category), prevBy = group(prev, (r) => r.category);
  const names = [...new Set([...Object.keys(nowBy), ...Object.keys(prevBy)])];
  const categories = names.map((name) => {
    const a = sum(nowBy[name] || []), p = sum(prevBy[name] || []);
    return { name, amount: a, prev: p, delta: a - p, share: Math.round((a / total) * 100) };
  }).sort((x, y) => y.amount - x.amount);
  const top = categories[0];
  const topRow = now.reduce((b, r) => (r.amount > b.amount ? r : b), now[0]);
  const largest = { merchant: topRow.merchant, amount: topRow.amount, date: topRow.date, category: topRow.category };

  // 1. overall change
  if (prev.length === 0) {
    notes.push(`No expenses were recorded in ${prevKey}${partial ? ` in its first ${cutoff} days` : ""}, so there is nothing to compare with.`);
  } else {
    const diff = Math.abs(total - prevTotal), then = partial ? `the first ${cutoff} days of last month` : "last month";
    insights.push({
      tone: changePct > 0 ? "up" : changePct < 0 ? "down" : "neutral", title: "Compared with last month",
      text: changePct === 0 ? `You spent ${m(total)}${period}, the same as ${then} (${m(prevTotal)}).`
        : `You spent ${m(total)}${period}, ${changePct > 0 ? "up" : "down"} ${Math.abs(changePct)}% (${m(diff)}) compared with ${then} (${m(prevTotal)}).`,
    });

    // 2. category changes, with the merchants behind them
    const big = 0.05 * Math.max(total, prevTotal);
    const why = (cat) => {
      const a = group(nowBy[cat] || [], (r) => norm(r.merchant)), p = group(prevBy[cat] || [], (r) => norm(r.merchant));
      return Object.keys(a).map((k) => ({ name: a[k][0].merchant, delta: sum(a[k]) - sum(p[k] || []) }))
        .filter((x) => x.delta > 0).sort((x, y) => y.delta - x.delta).slice(0, 2);
    };
    categories.filter((c) => c.delta > 0 && c.delta >= big && (c.prev === 0 || pct(c.amount, c.prev) >= 20))
      .sort((x, y) => y.delta - x.delta).slice(0, 3).forEach((c) => {
        const drivers = why(c.name);
        insights.push({
          tone: "up", title: `${c.name} went up`,
          text: (c.prev === 0 ? `${c.name} is new this month: ${m(c.amount)}${period}.` : `${c.name} spending rose ${pct(c.amount, c.prev)}% to ${m(c.amount)}${period} (from ${m(c.prev)}).`)
            + (drivers.length ? ` ${drivers.map((d) => `${d.name} added ${m(d.delta)}`).join(" and ")}.` : ""),
        });
      });
    categories.filter((c) => c.delta < 0 && -c.delta >= big && pct(c.amount, c.prev) <= -20)
      .sort((x, y) => x.delta - y.delta).slice(0, 2).forEach((c) => {
        insights.push({ tone: "down", title: `${c.name} went down`, text: `${c.name} spending fell ${Math.abs(pct(c.amount, c.prev))}% to ${m(c.amount)}${period} (from ${m(c.prev)}).` });
      });
  }

  // 3. largest category
  insights.push({ tone: "neutral", title: "Largest category", text: `${top.name} was your largest category at ${m(top.amount)}, ${top.share}% of your spending${period}.` });

  // 4. unusually high expenses, compared with your own history in the same category
  if (history.length < 5) {
    notes.push("Unusual-expense checks need at least a few expenses from earlier months. Keep tracking and they will appear.");
  } else {
    const hist = group(history, (r) => r.category);
    const odd = now.map((r) => {
      const h = (hist[r.category] || []).map((x) => x.amount);
      if (h.length < 5) return null;
      const med = median(h);
      return r.amount > mean(h) + 2 * sd(h) && r.amount > 2 * med ? { r, med, ratio: r.amount / med } : null;
    }).filter(Boolean).sort((x, y) => y.ratio - x.ratio).slice(0, 3);
    odd.forEach(({ r, med, ratio }) => insights.push({
      tone: "warn", title: "Unusually high expense",
      text: `${r.merchant} on ${r.date}: ${m(r.amount)} is ${ratio.toFixed(1)} times your typical ${r.category} expense (about ${m(med)}).`,
    }));
  }

  // 5. likely recurring expenses: same merchant in 3+ of the last 4 months with a similar monthly total
  const win = rows.filter((r) => r.date.slice(0, 7) <= month && r.date.slice(0, 7) >= shiftMonth(month, -3));
  const monthsWithData = new Set(win.map((r) => r.date.slice(0, 7))).size;
  if (monthsWithData < 3) {
    notes.push("Recurring-expense detection needs data from at least 3 different months.");
  } else {
    const rec = Object.values(group(win, (r) => norm(r.merchant))).map((list) => {
      const perMonth = Object.values(group(list, (r) => r.date.slice(0, 7))).map(sum);
      const avg = mean(perMonth);
      return perMonth.length >= 3 && perMonth.every((v) => Math.abs(v - avg) <= 0.15 * avg) ? { name: list[0].merchant, avg, n: perMonth.length } : null;
    }).filter(Boolean).sort((x, y) => y.avg - x.avg).slice(0, 5);
    if (rec.length) insights.push({ tone: "neutral", title: "Likely recurring expenses", text: rec.map((x) => `${x.name} (about ${m(x.avg)} a month, seen in ${x.n} of the last 4 months)`).join("; ") + "." });
  }

  // 6. budget performance (full month total against the monthly budget)
  let budgetInfo = null;
  if (budget > 0) {
    const used = Math.round((total / budget) * 100);
    budgetInfo = { limit: budget, spent: total, pct: used };
    insights.push({
      tone: used >= 100 ? "warn" : used >= 80 ? "warn" : "good", title: "Monthly budget",
      text: used >= 100 ? `You have spent ${m(total)}, which is ${m(total - budget)} over your ${m(budget)} budget (${used}%).`
        : `You have used ${used}% of your ${m(budget)} budget, with ${m(budget - total)} left.`,
    });
  }
  catBudgets.forEach((b) => {
    const spent = sum(nowBy[b.category] || []), used = Math.round((spent / b.amount) * 100);
    if (used >= 80) insights.push({ tone: "warn", title: `${b.category} budget`, text: used >= 100 ? `${b.category} is ${m(spent - b.amount)} over its ${m(b.amount)} budget (${used}%).` : `${b.category} has used ${used}% of its ${m(b.amount)} budget.` });
  });

  return { ...base, enough: true, total, prevTotal, count: now.length, changePct, topCategory: { name: top.name, amount: top.amount, share: top.share }, largest, categories, insights, notes, budget: budgetInfo };
}
