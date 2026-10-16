import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const NAVY = [17, 27, 46], MINT = [45, 212, 167];

export function categoryTotals(rows) {
  const m = {};
  rows.forEach((r) => { m[r.category] = (m[r.category] || 0) + r.amount; });
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function buildPDF({ rows, label, start, end, cur, name }) {
  const doc = new jsPDF();
  const money = (n) => `${cur} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const cats = categoryTotals(rows);

  doc.setFillColor(...NAVY); doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255); doc.setFontSize(18); doc.text("SmartSpend", 14, 13);
  doc.setFontSize(10); doc.text(`${label} expense report`, 14, 21);

  doc.setTextColor(30); doc.setFontSize(10);
  doc.text(`Period: ${start} to ${end}`, 14, 38);
  if (name) doc.text(`Prepared for: ${name}`, 14, 44);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 50);

  doc.setFontSize(13); doc.text("Summary", 14, 62);
  doc.setFontSize(10);
  doc.text(`Total spending: ${money(total)}`, 14, 70);
  doc.text(`Number of expenses: ${rows.length}`, 14, 76);
  if (cats[0]) doc.text(`Highest category: ${cats[0].name} (${money(cats[0].value)})`, 14, 82);

  // Simple bar chart drawn with rectangles
  let y = 94;
  doc.setFontSize(13); doc.text("Spending by category", 14, y); y += 6;
  doc.setFontSize(9);
  const max = cats[0]?.value || 1;
  cats.forEach((c) => {
    doc.setTextColor(30); doc.text(c.name, 14, y + 4);
    doc.setFillColor(...MINT); doc.rect(50, y, Math.max(1, (c.value / max) * 80), 5, "F");
    doc.text(`${money(c.value)} (${Math.round((c.value / total) * 100)}%)`, 134, y + 4);
    y += 8;
  });

  autoTable(doc, {
    startY: y + 6,
    head: [["Date", "Merchant", "Category", "Description", "Payment", "Amount"]],
    body: rows.map((r) => [r.date, r.merchant, r.category, r.description || "", r.paymentMethod || "", money(r.amount)]),
    foot: [["", "", "", "", "Total", money(total)]],
    headStyles: { fillColor: NAVY }, footStyles: { fillColor: [230, 245, 240], textColor: 30 },
    styles: { fontSize: 8 }, columnStyles: { 5: { halign: "right" } },
    didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(120); doc.text(`Page ${doc.getNumberOfPages()}`, 195, 290, { align: "right" }); },
  });
  doc.save(`smartspend-${start}_to_${end}.pdf`);
}

export function buildExcel({ rows, start, end }) {
  const data = rows.map((r) => ({
    Date: r.date, Merchant: r.merchant, Category: r.category,
    Description: r.description || "", Amount: r.amount, "Payment method": r.paymentMethod || "",
  }));
  data.push({ Date: "", Merchant: "", Category: "", Description: "Total", Amount: rows.reduce((t, r) => t + r.amount, 0), "Payment method": "" });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, `smartspend-${start}_to_${end}.xlsx`);
}