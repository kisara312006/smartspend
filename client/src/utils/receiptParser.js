const AMOUNT = /(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}(?!\d)/g;
const toNum = (s) => {
  const t = String(s);
  return Number(/,\d{2}$/.test(t) && !/\./.test(t) ? t.replace(",", ".") : t.replace(/,/g, ""));
};
const amountsIn = (line) => (line.match(AMOUNT) || []).map(toNum);
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SKIP = /(sub\s*-?\s*total|total|tax|vat|nbt|discount|saving|change|cash|card|visa|master|balance|tender|round|due|paid|amount)/i;
const HEADER = /(receipt|invoice|tel|phone|date|www|http|bill|customer|rep\b|item|qty|price|imei|iemi|seri|warranty|thank|authori|inv\b|no\s*:)/i;
const alphaRatio = (s) => (s.match(/[A-Za-z]/g) || []).length / Math.max(1, s.length);

const CATEGORY_WORDS = {
  Health: ["pharmacy", "hospital", "clinic", "medical", "laborator", "healthguard", "osusala"],
  Transport: ["fuel", "petrol", "diesel", "ceypetco", "ioc", "uber", "pickme", "taxi", "parking"],
  Bills: ["electricity", "water board", "dialog", "mobitel", "slt", "airtel", "hutch", "broadband", "leco"],
  Education: ["book", "stationery", "school", "university", "tuition", "institute"],
  Entertainment: ["cinema", "movie", "scope", "theatre", "netflix"],
  Groceries: ["supermarket", "grocery", "keells", "cargills", "arpico", "laugfs", "food city", "mart"],
  Food: ["restaurant", "cafe", "coffee", "pizza", "burger", "kfc", "mcdonald", "bakery", "kitchen"],
  Shopping: ["fashion", "clothing", "odel", "mall", "electronics", "boutique", "mobile", "city"],
};

function valid(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
}
export function findDate(text) {
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (m) { const a = +m[1], b = +m[2]; let y = +m[3]; if (y < 100) y += 2000; return valid(y, b, a) || valid(y, a, b); }
  m = text.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(20\d{2}|\d{2})\b/i);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]); }
  return null;
}
export function suggestCategory(text) {
  const t = text.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) if (words.some((w) => new RegExp(`\\b${w}`).test(t))) return cat;
  return "Other";
}

function cleanMerchant(line) {
  let words = line.replace(/[^A-Za-z0-9&'.()\- ]/g, " ").split(/\s+/).filter(Boolean);
  while (words.length && !/[A-Za-z]{3,}/.test(words[0])) words.shift();
  while (words.length && !/[A-Za-z]{3,}/.test(words[words.length - 1]) && !/^\(.*\)$/.test(words[words.length - 1])) words.pop();
  return words.join(" ").slice(0, 60);
}

export function parseReceipt(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const mLine = lines.slice(0, 10).find((l) => alphaRatio(l) >= 0.6 && l.length >= 6 && !HEADER.test(l) && !/\d{5,}/.test(l)) || "";
  const merchant = cleanMerchant(mLine);

  let total = null, netTotal = null, subtotal = null, discount = 0, tax = 0;
  for (const l of lines) {
    const a = amountsIn(l); if (!a.length) continue;
    const last = a[a.length - 1];
    if (/sub\s*-?\s*total/i.test(l)) { if (subtotal === null) subtotal = last; }
    else if (/net\s*total|amount\s*due|balance\s*due|net\s*amount|grand\s*total/i.test(l)) netTotal = Math.max(netTotal ?? 0, last);
    else if (/total/i.test(l)) total = Math.max(total ?? 0, last);
    else if (/discount|saving|promo/i.test(l)) discount += last;
    else if (/tax|vat|nbt/i.test(l)) tax += last;
  }
  total = netTotal ?? total;
  if (total === null) { const all = lines.flatMap(amountsIn); total = all.length ? Math.max(...all) : null; }

  const items = [];
  lines.forEach((l, idx) => {
    if (SKIP.test(l)) return;
    const a = amountsIn(l); if (!a.length) return;
    let rest = l.replace(AMOUNT, " ").replace(/\s+/g, " ").trim();
    let qty = 1, name = rest;
    const lead = rest.match(/^[^A-Za-z]*?(\d{1,2})\b\s*[xX*]?\s*(.*)$/);
    const q = rest.match(/^(\d+)\s*[xX*]\s+(.*)$/);
    if (q) { qty = +q[1]; name = q[2]; }
    name = name.replace(/[^A-Za-z0-9&'.\-/ ]/g, "").trim();
    if (!/[A-Za-z]{2,}/.test(name)) {                     // amounts on their own line: name is on an earlier line
      if (lead) qty = +lead[1] || 1;
      name = "";
      for (let k = idx - 1; k >= Math.max(0, idx - 3); k--) {
        const p = lines[k];
        if (amountsIn(p).length || SKIP.test(p) || HEADER.test(p) || alphaRatio(p) < 0.4) continue;
        name = p.replace(/[^A-Za-z0-9&'.\-/() ]/g, "").trim(); break;
      }
    }
    name = name.replace(/\s+/g, " ").replace(/(\s+[A-Za-z_|.,:;'"-])+$/, "").trim();
    if (name.length < 2) return;
    items.push({ name: name.slice(0, 60), qty, amount: a[a.length - 1] });
  });
  return { merchant, date: findDate(text), total, subtotal, discount, tax, items: items.slice(0, 50), category: suggestCategory(merchant + " " + lines.slice(0, 4).join(" ")) };
}
