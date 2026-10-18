import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

const PAGES = [
  { to: "/", label: "Daily Entry" },
  { to: "/customers", label: "Customers" },
  { to: "/payments", label: "Payments" },
  { to: "/expenses", label: "Expenses" },
  { to: "/history", label: "History" },
] as const;

type PagePath = (typeof PAGES)[number]["to"];
type CurrentPage = PagePath | "/customers/$id";

export function PageNav({ current }: { current: CurrentPage }) {
  const customerIndex = PAGES.findIndex((page) => page.to === "/customers");
  const isCustomerDetail = current === "/customers/$id";
  const currentIndex = isCustomerDetail
    ? customerIndex
    : PAGES.findIndex((page) => page.to === current);
  const prev = currentIndex > 0 ? PAGES[isCustomerDetail ? customerIndex : currentIndex - 1] : null;
  const nextIndex = isCustomerDetail ? customerIndex + 1 : currentIndex + 1;
  const next = currentIndex >= 0 && nextIndex < PAGES.length ? PAGES[nextIndex] : null;

  return (
    <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-4">
      {prev ? (
        <Link
          to={prev.to}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="size-4" />
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={next.to}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          {next.label}
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
