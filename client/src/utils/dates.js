// Local-time date helpers. Dates are stored as "YYYY-MM-DD" strings.
export const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const monthKey = (d) => localISO(d).slice(0, 7); // "2026-10"

export const monthBounds = (key) => {
  const [y, m] = key.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return { start: `${key}-01`, end: `${key}-${String(days).padStart(2, "0")}`, days };
};

export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};