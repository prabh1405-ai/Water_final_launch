import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Customer, Expense, Txn, WaterFillingRecord } from "@/lib/store";

type RowWithOwner<T> = T & { user_id: string };
type TableDefinition<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      ledger_customers: TableDefinition<
        RowWithOwner<Customer>,
        Omit<RowWithOwner<Customer>, "user_id"> & { user_id?: string }
      >;
      ledger_transactions: TableDefinition<
        RowWithOwner<Txn>,
        Omit<RowWithOwner<Txn>, "user_id"> & { user_id?: string }
      >;
      ledger_expenses: TableDefinition<
        RowWithOwner<Expense>,
        Omit<RowWithOwner<Expense>, "user_id"> & { user_id?: string }
      >;
      ledger_water_filling: TableDefinition<
        RowWithOwner<WaterFillingRecord>,
        Omit<RowWithOwner<WaterFillingRecord>, "user_id"> & { user_id?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (Boolean(url) !== Boolean(anonKey)) {
  throw new Error("Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured.");
}

export const supabase: SupabaseClient<Database> | null =
  url && anonKey
    ? createClient<Database>(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;
