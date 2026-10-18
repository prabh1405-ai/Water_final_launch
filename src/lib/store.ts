import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase, type Database } from "@/lib/supabase";

export { supabase } from "@/lib/supabase";

export type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  defaultRate: number;
  openingPending: number;
  openingCans: number;
  notes?: string;
};

export type Txn = {
  id: string;
  customerId: string;
  date: string; // yyyy-mm-dd
  type: "delivery" | "payment";
  entryId?: string;
  cans?: number;
  cansReturned?: number;
  currentStock?: number;
  rate?: number;
  amount: number; // delivery amount or payment amount (always positive)
  createdAt: number;
};

export type Expense = {
  id: string;
  date: string;
  diesel: number;
  snacksFood: number;
  serviceRepairs?: number;
  serviceNotes?: string;
  createdAt: number;
};

export type WaterFillingRecord = {
  id: string;
  date: string;
  batches: { cans: number; rate: number }[];
  createdAt: number;
};

export type Data = {
  customers: Customer[];
  txns: Txn[];
  expenses: Expense[];
  waterFilling: WaterFillingRecord[];
};

export const RATES = [25, 30, 35, 40, 45, 50];

const KEY = "water-can-accounts-v1";

export const getDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const seedCustomers: Customer[] = [
  ["Sri Lakshmi Hotel", "Ramesh", "98400 12345", 30, 2450, 12],
  ["Sri Vinayaga Stores", "Karthik", "98401 22345", 25, 0, 5],
  ["Sri Sakthi Traders", "Murali", "98402 33456", 35, 800, 8],
  ["Sri Murugan Mess", "Selvam", "98403 44567", 30, 350, 4],
  ["ABC Hotel", "Anand", "98404 55678", 30, 1200, 15],
  ["Green Leaf Cafe", "Divya", "98405 66789", 40, 0, 6],
  ["Annapoorna Caterers", "Suresh", "98406 77890", 30, 1500, 10],
  ["Taj Tea Stall", "Ismail", "98407 88901", 25, 250, 3],
  ["Blue Star Residency", "Prakash", "98408 99012", 35, 2100, 14],
  ["Kavitha Bakery", "Kavitha", "98409 00123", 30, 0, 5],
].map(([name, contact, phone, defaultRate, openingPending, openingCans], i) => ({
  id: `seed-${i + 1}`,
  name: name as string,
  contact: contact as string,
  phone: phone as string,
  defaultRate: defaultRate as number,
  openingPending: openingPending as number,
  openingCans: openingCans as number,
}));

export function getSeedTxns(): Txn[] {
  const days = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  const deliveryPlan: Record<string, { baseCans: number[]; returnOffset: number[] }> = {
    "seed-1": { baseCans: [10, 12, 14, 11, 13, 15, 12, 11, 14, 12], returnOffset: [2, 1, 2, 1, 2, 2, 1, 1, 2, 2] },
    "seed-2": { baseCans: [8, 7, 9, 8, 7, 10, 8, 8, 9, 8], returnOffset: [1, 1, 2, 1, 0, 2, 1, 1, 1, 1] },
    "seed-3": { baseCans: [12, 15, 14, 13, 16, 14, 15, 13, 15, 14], returnOffset: [2, 2, 1, 2, 2, 1, 2, 1, 2, 2] },
    "seed-4": { baseCans: [6, 5, 7, 6, 5, 8, 6, 7, 6, 8], returnOffset: [1, 1, 1, 1, 0, 2, 1, 1, 1, 1] },
    "seed-5": { baseCans: [16, 20, 18, 17, 19, 22, 18, 17, 20, 18], returnOffset: [3, 2, 2, 2, 3, 3, 2, 2, 3, 2] },
    "seed-6": { baseCans: [8, 10, 12, 9, 11, 10, 12, 9, 10, 11], returnOffset: [1, 2, 2, 1, 2, 1, 2, 1, 1, 2] },
    "seed-7": { baseCans: [14, 16, 15, 18, 14, 16, 15, 17, 14, 16], returnOffset: [2, 2, 2, 3, 1, 2, 2, 2, 2, 2] },
    "seed-8": { baseCans: [10, 12, 11, 10, 13, 11, 12, 10, 11, 12], returnOffset: [1, 2, 1, 1, 2, 1, 2, 1, 1, 2] },
    "seed-9": { baseCans: [15, 18, 16, 17, 20, 16, 18, 15, 17, 19], returnOffset: [2, 3, 2, 2, 3, 2, 3, 2, 2, 3] },
    "seed-10": { baseCans: [6, 8, 7, 6, 9, 7, 8, 6, 7, 8], returnOffset: [1, 1, 1, 1, 2, 1, 1, 1, 1, 1] },
  };

  const paymentsPlan = [
    { customerId: "seed-1", daysAgo: 6, amount: 2500 },
    { customerId: "seed-1", daysAgo: 1, amount: 1500 },
    { customerId: "seed-2", daysAgo: 7, amount: 1200 },
    { customerId: "seed-2", daysAgo: 2, amount: 1000 },
    { customerId: "seed-3", daysAgo: 5, amount: 2800 },
    { customerId: "seed-3", daysAgo: 1, amount: 2000 },
    { customerId: "seed-4", daysAgo: 8, amount: 1000 },
    { customerId: "seed-4", daysAgo: 3, amount: 1200 },
    { customerId: "seed-5", daysAgo: 6, amount: 3500 },
    { customerId: "seed-5", daysAgo: 1, amount: 2800 },
    { customerId: "seed-6", daysAgo: 7, amount: 2400 },
    { customerId: "seed-6", daysAgo: 0, amount: 1600 },
    { customerId: "seed-7", daysAgo: 5, amount: 3000 },
    { customerId: "seed-7", daysAgo: 2, amount: 2500 },
    { customerId: "seed-8", daysAgo: 6, amount: 1800 },
    { customerId: "seed-8", daysAgo: 1, amount: 1500 },
    { customerId: "seed-9", daysAgo: 4, amount: 3500 },
    { customerId: "seed-9", daysAgo: 0, amount: 3000 },
    { customerId: "seed-10", daysAgo: 5, amount: 1200 },
    { customerId: "seed-10", daysAgo: 1, amount: 1000 },
  ];

  const list: Txn[] = [];
  let txnId = 1;

  days.forEach((dayAgo, dayIdx) => {
    const dateStr = getDateStr(dayAgo);

    seedCustomers.forEach((cust, custIdx) => {
      const plan = deliveryPlan[cust.id];
      const cans = plan?.baseCans[dayIdx] ?? 10;
      const returned = Math.max(0, cans - (plan?.returnOffset[dayIdx] ?? 1));
      const rate = cust.defaultRate;
      const amount = cans * rate;
      const hour = 7 + Math.floor(custIdx / 3);
      const min = (custIdx % 3) * 20;
      const createdAt = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`).getTime();

      list.push({
        id: `seed-del-${txnId++}`,
        customerId: cust.id,
        date: dateStr,
        type: "delivery",
        cans,
        cansReturned: returned,
        rate,
        amount,
        createdAt,
      });
    });
  });

  paymentsPlan.forEach((p, pIdx) => {
    const dateStr = getDateStr(p.daysAgo);
    const hour = p.daysAgo === 0 ? 9 + (pIdx % 4) : 10 + (pIdx % 4);
    const minute = (pIdx * 7) % 60;
    const createdAt = new Date(
      `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
    ).getTime();
    list.push({
      id: `seed-pay-${pIdx + 1}`,
      customerId: p.customerId,
      date: dateStr,
      type: "payment",
      amount: p.amount,
      createdAt,
    });
  });

  return list;
}

export function getSeedExpenses(): Expense[] {
  const d9 = getDateStr(9);
  const d8 = getDateStr(8);
  const d7 = getDateStr(7);
  const d6 = getDateStr(6);
  const d5 = getDateStr(5);
  const d4 = getDateStr(4);
  const d3 = getDateStr(3);
  const d2 = getDateStr(2);
  const d1 = getDateStr(1);
  const d0 = getDateStr(0);

  const t = (dateStr: string, hour = 18) =>
    new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`).getTime();

  return [
    { id: "seed-exp-1", date: d9, diesel: 450, snacksFood: 120, serviceRepairs: 0, createdAt: t(d9) },
    { id: "seed-exp-2", date: d8, diesel: 500, snacksFood: 150, serviceRepairs: 0, createdAt: t(d8) },
    { id: "seed-exp-3", date: d7, diesel: 400, snacksFood: 110, serviceRepairs: 0, createdAt: t(d7) },
    { id: "seed-exp-4", date: d6, diesel: 550, snacksFood: 140, serviceRepairs: 450, createdAt: t(d6) },
    { id: "seed-exp-5", date: d5, diesel: 500, snacksFood: 130, serviceRepairs: 0, createdAt: t(d5) },
    { id: "seed-exp-6", date: d4, diesel: 600, snacksFood: 160, serviceRepairs: 0, createdAt: t(d4) },
    { id: "seed-exp-7", date: d3, diesel: 450, snacksFood: 125, serviceRepairs: 0, createdAt: t(d3) },
    { id: "seed-exp-8", date: d2, diesel: 500, snacksFood: 140, serviceRepairs: 800, createdAt: t(d2) },
    { id: "seed-exp-9", date: d1, diesel: 450, snacksFood: 115, serviceRepairs: 0, createdAt: t(d1) },
    { id: "seed-exp-10", date: d0, diesel: 500, snacksFood: 150, serviceRepairs: 0, createdAt: t(d0) },
  ];
}

const emptyData = (): Data => ({
  customers: [],
  txns: [],
  expenses: [],
  waterFilling: [],
});

let data: Data = supabase
  ? emptyData()
  : {
      customers: seedCustomers,
      txns: getSeedTxns(),
      expenses: getSeedExpenses(),
      waterFilling: [],
  };

let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  if (supabase) {
    data = emptyData();
    return;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Data>;
      const migratedCustomers = (parsed.customers ?? seedCustomers).map((c) => ({
        ...c,
        openingCans: c.openingCans ?? 0,
      }));
      data = {
        customers: migratedCustomers,
        txns: parsed.txns ?? [],
        expenses: parsed.expenses ?? [],
        waterFilling: parsed.waterFilling ?? [],
      };
    } else {
      data = {
        customers: seedCustomers,
        txns: getSeedTxns(),
        expenses: getSeedExpenses(),
        waterFilling: [],
      };
      persist();
    }
  } catch {
    /* ignore */
  }
}

function persist() {
  if (!supabase && typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  }
  listeners.forEach((l) => l());
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      listeners.forEach((l) => l());
    }
  });
}

export function useData(): Data {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return data;
    },
    () => data,
  );
}

const uid = () => Math.random().toString(36).slice(2, 10);

async function requireUserId() {
  if (!supabase) return null;
  const { data: result, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!result.user) throw new Error("Sign in is required to change ledger data.");
  return result.user.id;
}

type CustomerRow = Database["public"]["Tables"]["ledger_customers"]["Row"];
type TransactionRow = Database["public"]["Tables"]["ledger_transactions"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["ledger_expenses"]["Row"];
type WaterFillingRow = Database["public"]["Tables"]["ledger_water_filling"]["Row"];

async function upsertCustomer(customer: Customer) {
  if (!supabase) return;
  const userId = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("ledger_customers")
    .upsert({ ...customer, user_id: userId });
  if (error) throw error;
}

async function upsertTransactions(txns: Txn[]) {
  if (!supabase || txns.length === 0) return;
  const userId = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("ledger_transactions")
    .upsert(txns.map((txn) => ({ ...txn, user_id: userId })));
  if (error) throw error;
}

async function upsertExpenseRecord(expense: Expense) {
  if (!supabase) return;
  const userId = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("ledger_expenses")
    .upsert({ ...expense, user_id: userId }, { onConflict: "user_id,date" });
  if (error) throw error;
}

async function upsertWaterFillingRecord(record: WaterFillingRecord) {
  if (!supabase) return;
  const userId = await requireUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("ledger_water_filling")
    .upsert({ ...record, user_id: userId }, { onConflict: "user_id,date" });
  if (error) throw error;
}

async function deleteRemoteRow(table: "ledger_transactions" | "ledger_expenses", id: string) {
  if (!supabase) return;
  await requireUserId();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function addCustomer(c: Omit<Customer, "id">) {
  load();
  const customer = { ...c, id: uid() };
  await upsertCustomer(customer);
  data = { ...data, customers: [...data.customers, customer] };
  persist();
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  load();
  const customer = data.customers.find((item) => item.id === id);
  if (!customer) return;
  const updatedCustomer = { ...customer, ...patch };
  await upsertCustomer(updatedCustomer);
  data = {
    ...data,
    customers: data.customers.map((c) => (c.id === id ? updatedCustomer : c)),
  };
  persist();
}

export async function addTxn(t: Omit<Txn, "id" | "createdAt">, createdAt = Date.now()) {
  await addTxns([t], createdAt);
}

export async function addTxns(txns: Omit<Txn, "id" | "createdAt">[], createdAt = Date.now()) {
  if (txns.length === 0) return;
  load();
  const entryId = uid();
  const newTransactions = txns.map((txn) => ({ ...txn, id: uid(), entryId, createdAt }));
  await upsertTransactions(newTransactions);
  data = {
    ...data,
    txns: [...data.txns, ...newTransactions],
  };
  persist();
}

export async function updateTxn(id: string, patch: Partial<Txn>) {
  load();
  const current = data.txns.find((txn) => txn.id === id);
  const syncEntry = current && (patch.date !== undefined || patch.createdAt !== undefined);
  const transactions = data.txns.map((txn) => {
      if (txn.id === id) return { ...txn, ...patch };
      if (syncEntry && current && sameTransactionEntry(current, txn)) {
        return {
          ...txn,
          ...(patch.date !== undefined ? { date: patch.date } : {}),
          ...(patch.createdAt !== undefined ? { createdAt: patch.createdAt } : {}),
        };
      }
      return txn;
    });
  await upsertTransactions(transactions.filter((txn) => txn.id === id || (syncEntry && current && sameTransactionEntry(current, txn))));
  data = { ...data, txns: transactions };
  persist();
}

export async function deleteTxn(id: string) {
  load();
  await deleteRemoteRow("ledger_transactions", id);
  data = { ...data, txns: data.txns.filter((t) => t.id !== id) };
  persist();
}

export async function upsertExpense(expense: Omit<Expense, "id" | "createdAt">) {
  load();
  const existing = data.expenses.find((item) => item.date === expense.date);
  const updatedExpense = existing
    ? { ...existing, ...expense, createdAt: Date.now() }
    : { ...expense, id: uid(), createdAt: Date.now() };
  await upsertExpenseRecord(updatedExpense);
  data = {
    ...data,
    expenses: existing
      ? data.expenses.map((item) => item.id === existing.id ? updatedExpense : item)
      : [...data.expenses, updatedExpense],
  };
  persist();
}

export async function upsertWaterFilling(
  date: string,
  batches: WaterFillingRecord["batches"],
) {
  load();
  const existing = data.waterFilling.find((record) => record.date === date);
  const record: WaterFillingRecord = existing
    ? { ...existing, batches, createdAt: Date.now() }
    : { id: uid(), date, batches, createdAt: Date.now() };
  await upsertWaterFillingRecord(record);
  data = {
    ...data,
    waterFilling: existing
      ? data.waterFilling.map((item) => (item.id === existing.id ? record : item))
      : [...data.waterFilling, record],
  };
  persist();
}

export async function deleteExpense(id: string) {
  load();
  await deleteRemoteRow("ledger_expenses", id);
  data = { ...data, expenses: data.expenses.filter((expense) => expense.id !== id) };
  persist();
}

export async function reloadData() {
  if (!supabase) {
    load();
    return;
  }
  await requireUserId();
  const [customers, txns, expenses, waterFilling] = await Promise.all([
    fetchAllCustomers(),
    fetchAllTransactions(),
    fetchAllExpenses(),
    fetchAllWaterFilling(),
  ]);
  data = {
    customers: customers.map(withoutOwner),
    txns: txns.map(withoutOwner),
    expenses: expenses.map(withoutOwner),
    waterFilling: waterFilling.map(withoutOwner),
  };
  loaded = true;
  notify();
}

const FETCH_PAGE_SIZE = 1000;

async function fetchAllCustomers(): Promise<CustomerRow[]> {
  const rows: CustomerRow[] = [];
  let offset = 0;
  for (;;) {
    const { data: page, error } = await supabase!
      .from("ledger_customers")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    if (page.length === 0) return rows;
    rows.push(...page);
    offset += page.length;
  }
}

async function fetchAllTransactions(): Promise<TransactionRow[]> {
  const rows: TransactionRow[] = [];
  let offset = 0;
  for (;;) {
    const { data: page, error } = await supabase!
      .from("ledger_transactions")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    if (page.length === 0) return rows;
    rows.push(...page);
    offset += page.length;
  }
}

async function fetchAllExpenses(): Promise<ExpenseRow[]> {
  const rows: ExpenseRow[] = [];
  let offset = 0;
  for (;;) {
    const { data: page, error } = await supabase!
      .from("ledger_expenses")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    if (page.length === 0) return rows;
    rows.push(...page);
    offset += page.length;
  }
}

async function fetchAllWaterFilling(): Promise<WaterFillingRow[]> {
  const rows: WaterFillingRow[] = [];
  let offset = 0;
  for (;;) {
    const { data: page, error } = await supabase!
      .from("ledger_water_filling")
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    if (page.length === 0) return rows;
    rows.push(...page);
    offset += page.length;
  }
}

function withoutOwner<T extends { user_id: string }>(row: T): Omit<T, "user_id"> {
  const { user_id: _userId, ...record } = row;
  return record;
}

export function clearCachedData() {
  data = emptyData();
  loaded = true;
  notify();
}

/* ---------- derived helpers (pure) ---------- */

export function sortTxns(txns: Txn[]) {
  return [...txns].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.type === b.type ? 0 : a.type === "delivery" ? -1 : 1;
  });
}

export function sameTransactionEntry(a: Txn, b: Txn) {
  if (a.entryId || b.entryId) return !!a.entryId && a.entryId === b.entryId;
  return a.customerId === b.customerId && a.date === b.date && a.createdAt === b.createdAt;
}

export type TransactionEntry = {
  id: string;
  customerId: string;
  date: string;
  createdAt: number;
  kind: "delivery" | "payment" | "mixed";
  delivery?: Txn;
  payment?: Txn;
};

export function transactionEntries(txns: Txn[]): TransactionEntry[] {
  const groups = new Map<string, Txn[]>();
  for (const txn of txns) {
    const key = txn.entryId
      ? `entry:${txn.entryId}`
      : `legacy:${txn.customerId}:${txn.date}:${txn.createdAt}`;
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const entries: TransactionEntry[] = [];
  for (const group of groups.values()) {
    const deliveries = group.filter((txn) => txn.type === "delivery");
    const payments = group.filter((txn) => txn.type === "payment");
    if (group.length === 2 && deliveries.length === 1 && payments.length === 1) {
      const delivery = deliveries[0]!;
      const payment = payments[0]!;
      entries.push({
        id: delivery.entryId ?? `${delivery.id}:${payment.id}`,
        customerId: delivery.customerId,
        date: delivery.date,
        createdAt: delivery.createdAt,
        kind: "mixed",
        delivery,
        payment,
      });
      continue;
    }

    for (const txn of group) {
      entries.push({
        id: txn.id,
        customerId: txn.customerId,
        date: txn.date,
        createdAt: txn.createdAt,
        kind: txn.type,
        ...(txn.type === "delivery" ? { delivery: txn } : { payment: txn }),
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function transactionEntryKinds(txns: Txn[]): Map<string, "delivery" | "payment" | "mixed"> {
  const grouped = new Map<string, Txn[]>();
  for (const txn of txns) {
    const key = txn.entryId
      ? `entry:${txn.entryId}`
      : `legacy:${txn.customerId}:${txn.date}:${txn.createdAt}`;
    const group = grouped.get(key) ?? [];
    group.push(txn);
    grouped.set(key, group);
  }

  const kinds = new Map<string, "delivery" | "payment" | "mixed">();
  for (const group of grouped.values()) {
    const hasDelivery = group.some((txn) => txn.type === "delivery");
    const hasPayment = group.some((txn) => txn.type === "payment");
    if (group.length === 2 && hasDelivery && hasPayment) {
      for (const txn of group) kinds.set(txn.id, "mixed");
    } else {
      for (const txn of group) kinds.set(txn.id, txn.type);
    }
  }
  return kinds;
}

export function currentTime() {
  const now = new Date();
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

export function timestampForEntry(date: string, time: string) {
  if (!date || !time) return null;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const timestamp = new Date(`${date}T${normalizedTime}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function customerTxns(d: Data, customerId: string) {
  return sortTxns(d.txns.filter((t) => t.customerId === customerId));
}

export function pendingFor(d: Data, c: Customer) {
  return customerTxns(d, c.id).reduce(
    (bal, t) => (t.type === "delivery" ? bal + t.amount : bal - t.amount),
    c.openingPending,
  );
}

export function cansWith(d: Data, customerId: string) {
  const customer = d.customers.find((c) => c.id === customerId);
  return customerTxns(d, customerId).reduce(
    (n, t) => n + (t.cans ?? 0) - (t.cansReturned ?? 0),
    customer?.openingCans ?? 0,
  );
}

export function lastPaymentDate(d: Data, customerId: string): string | null {
  const pays = customerTxns(d, customerId).filter((t) => t.type === "payment");
  return pays.length ? pays[pays.length - 1]!.date : null;
}

export function daysSince(date: string, today: string): number | null {
  if (!today) return null;
  const todayStart = Date.parse(`${today}T00:00:00Z`);
  const dateStart = Date.parse(`${date}T00:00:00Z`);
  return Math.max(0, Math.floor((todayStart - dateStart) / 86400000));
}

export function useHydratedToday(): string {
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(todayISO());
  }, []);
  return today;
}

export const todayISO = () => {
  if (typeof document === "undefined") return "";
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const rupees = (n: number) => {
  const rounded = Math.round(n);
  if (rounded < 0) return `-₹${Math.abs(rounded).toLocaleString("en-IN")}`;
  return `₹${rounded.toLocaleString("en-IN")}`;
};

export const shortDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export const shortTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export function filterCustomersByAlphabet(customers: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (!q) return customers;

  const matches = customers.filter((c) => {
    const nameLower = c.name.toLowerCase();
    if (nameLower.startsWith(q)) return true;

    // Split words by spaces, hyphens, etc.
    const words = nameLower.split(/[\s\-_\/]+/);
    if (words.some((w) => w.startsWith(q))) return true;

    // Also check contact person words
    if (c.contact) {
      const contactWords = c.contact.toLowerCase().split(/[\s\-_\/]+/);
      if (contactWords.some((w) => w.startsWith(q))) return true;
    }

    // If multi-character query and no word starts with it, fallback to substring match
    if (q.length >= 3 && nameLower.includes(q)) return true;

    return false;
  });

  // Sort results:
  // 1. Company name directly starts with q
  // 2. Any word in company name starts with q
  // 3. Alphabetical
  return matches.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aStart = aName.startsWith(q);
    const bStart = bName.startsWith(q);
    if (aStart && !bStart) return -1;
    if (!aStart && bStart) return 1;

    const aWords = aName.split(/[\s\-_\/]+/);
    const bWords = bName.split(/[\s\-_\/]+/);
    const aWordStart = aWords.some((w) => w.startsWith(q));
    const bWordStart = bWords.some((w) => w.startsWith(q));
    if (aWordStart && !bWordStart) return -1;
    if (!aWordStart && bWordStart) return 1;

    return aName.localeCompare(bName);
  });
}
