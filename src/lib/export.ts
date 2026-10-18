import type { Customer, Data, Txn } from "@/lib/store";
import { sortTxns } from "@/lib/store";

const HEADERS = [
  "Heading",
  "Date",
  "Day",
  "Company Name",
  "No. of Cans",
  "Price",
  "Amount",
  "Total Pending",
];

const WIDTHS = [18, 14, 12, 26, 12, 10, 14, 16];

function longDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function dayName(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
}

/** Excel sheet names: max 31 chars, no []:*?/\ and must be unique. */
export function safeSheetName(name: string, used: Set<string>) {
  const base = (name.replace(/[[\]:*?/\\]/g, " ").trim() || "Company").slice(0, 31);
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

type Row = (string | number)[];

function expenseRows(data: Data, endDate: string, startDate?: string): Row[] {
  const rows: Row[] = [["Date", "Day", "Diesel", "Snacks and Food", "Total"]];
  const expenses = [...data.expenses]
    .filter((expense) => expense.date <= endDate && (!startDate || expense.date >= startDate))
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

  for (const expense of expenses) {
    rows.push([
      longDate(expense.date),
      dayName(expense.date),
      expense.diesel,
      expense.snacksFood,
      expense.diesel + expense.snacksFood,
    ]);
  }
  return rows;
}

export function companyRows(
  data: Data,
  customer: Customer,
  endDate: string,
  startDate?: string,
): Row[] {
  const allCustomerTxns = sortTxns(
    data.txns.filter((t) => t.customerId === customer.id && t.date <= endDate),
  );

  let pending = customer.openingPending;
  const priorTxns = startDate ? allCustomerTxns.filter((t) => t.date < startDate) : [];
  for (const t of priorTxns) {
    pending = t.type === "delivery" ? pending + t.amount : pending - t.amount;
  }

  const periodTxns = startDate
    ? allCustomerTxns.filter((t) => t.date >= startDate)
    : allCustomerTxns;

  let totalCans = 0;
  let totalDelivery = 0;
  let totalPayment = 0;

  const openingLabel = startDate ? `Opening Pending (${longDate(startDate)})` : "Opening Pending";
  const rows: Row[] = [
    [openingLabel, "", "", customer.name, 0, 0, 0, pending],
  ];

  for (const t of periodTxns) {
    if (t.type === "delivery") {
      const cans = t.cans ?? 0;
      const price = t.rate ?? 0;
      const amount = t.amount;
      pending += amount;
      totalCans += cans;
      totalDelivery += amount;
      rows.push([
        "Delivery",
        longDate(t.date),
        dayName(t.date),
        customer.name,
        cans,
        price,
        amount,
        pending,
      ]);
    } else {
      pending -= t.amount;
      totalPayment += t.amount;
      rows.push([
        "Payment",
        longDate(t.date),
        dayName(t.date),
        customer.name,
        0,
        0,
        -t.amount,
        pending,
      ]);
    }
  }

  rows.push(["TOTAL", "", "", customer.name, totalCans, "", totalDelivery, pending]);
  return rows;
}

/** Build and download an .xlsx workbook. companyId = null means all companies. */
export async function exportLedgerExcel(
  data: Data,
  companyId: string | null,
  endDate: string,
  startDate?: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const targets = companyId
    ? data.customers.filter((c) => c.id === companyId)
    : [...data.customers].sort((a, b) => a.name.localeCompare(b.name));

  const dateRangeLabel = startDate
    ? `${longDate(startDate)} to ${longDate(endDate)}`
    : `up to ${longDate(endDate)}`;

  const used = new Set<string>();
  for (const customer of targets) {
    const ws = wb.addWorksheet(safeSheetName(customer.name, used));
    ws.columns = WIDTHS.map((width) => ({ width }));

    const titleRow = ws.addRow([`${customer.name} — Ledger (${dateRangeLabel})`]);
    titleRow.font = { bold: true, size: 13 };
    ws.mergeCells(1, 1, 1, HEADERS.length);
    ws.addRow([]);

    const header = ws.addRow(HEADERS);
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    for (const r of companyRows(data, customer, endDate, startDate)) {
      const row = ws.addRow(r);
      [5, 6, 7, 8].forEach((i) => {
        row.getCell(i).numFmt = "#,##0";
      });
    }
    const last = ws.lastRow;
    if (last) last.font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  if (!companyId) {
    const ws = wb.addWorksheet("Expenses");
    ws.columns = [14, 14, 14, 20, 14].map((width) => ({ width }));
    const title = ws.addRow([`Business expenses (${dateRangeLabel})`]);
    title.font = { bold: true, size: 13 };
    ws.mergeCells(1, 1, 1, 5);
    ws.addRow([]);
    const rows = expenseRows(data, endDate, startDate);
    const header = ws.addRow(rows[0]);
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    for (const rowData of rows.slice(1)) {
      const row = ws.addRow(rowData);
      [3, 4, 5].forEach((i) => {
        row.getCell(i).numFmt = "#,##0";
      });
    }
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  if (targets.length === 0) wb.addWorksheet("No data");

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const label = companyId && targets[0]
    ? targets[0].name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
    : "all-companies";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `water-can-ledger-${label}-${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
