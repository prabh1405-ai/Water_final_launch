import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { filterCustomersByAlphabet, type Customer } from "@/lib/store";
import { cn } from "@/lib/utils";

export function CompanySelect({
  customers,
  value,
  onChange,
  placeholder = "Search company...",
}: {
  customers: Customer[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = customers.find((c) => c.id === value) ?? null;
  const matches = useMemo(() => {
    const list = filterCustomersByAlphabet(customers, query);
    return list.slice(0, 20);
  }, [customers, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            "h-11 w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? selected.name : placeholder}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-2"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a few letters..."
          className="h-10"
        />
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {matches.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">No company found</li>
          )}
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <span>{c.name}</span>
                {value === c.id && <Check className="size-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
