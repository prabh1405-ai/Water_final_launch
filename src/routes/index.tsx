import { createFileRoute } from "@tanstack/react-router";
import { DeliveryForm } from "@/components/DeliveryForm";
import { PageNav } from "@/components/PageNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Daily Entry — Water Can Accounts" },
      { name: "description", content: "Record can deliveries and payments in seconds." },
      { property: "og:title", content: "Daily Entry — Water Can Accounts" },
      { property: "og:description", content: "Record can deliveries and payments in seconds." },
    ],
  }),
  component: DailyEntry,
});

function DailyEntry() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Daily Entry</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search company, enter delivered cans, rate, and save entry.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
        <DeliveryForm />
      </div>

      <PageNav current="/" />
    </div>
  );
}
