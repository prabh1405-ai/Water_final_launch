import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageNav } from "@/components/PageNav";
import { RATES, addCustomer, filterCustomersByAlphabet, pendingFor, rupees, useData } from "@/lib/store";

export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — Water Can Accounts" },
      { name: "description", content: "All companies, contacts and their pending amounts." },
      { property: "og:title", content: "Customers — Water Can Accounts" },
      { property: "og:description", content: "All companies, contacts and their pending amounts." },
    ],
  }),
  component: CustomersPage,
});

function AddCustomerDialog() {
  const { customers } = useData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("30");
  const [opening, setOpening] = useState("");
  const [openingCans, setOpeningCans] = useState("");
  const [notes, setNotes] = useState("");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a company name");
      return;
    }
    if (customers.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This company already exists");
      return;
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone && !/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Enter a valid 10-digit phone number or leave it blank");
      return;
    }
    try {
      await addCustomer({
        name: trimmed,
        contact: contact.trim(),
        phone: normalizedPhone,
        defaultRate: Number(rate),
        openingPending: Math.max(0, Math.floor(Number(opening || 0))),
        openingCans: Math.max(0, Math.floor(Number(openingCans || 0))),
        notes: notes.trim(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? `Could not add customer: ${error.message}` : "Could not add customer");
      return;
    }
    toast.success("Customer added");
    setName("");
    setContact("");
    setPhone("");
    setOpening("");
    setOpeningCans("");
    setNotes("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">+ Add Customer</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Company name</Label>
            <Input id="c-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-contact">Contact person</Label>
              <Input
                id="c-contact"
                className="h-11"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone number</Label>
              <Input
                id="c-phone"
                inputMode="tel"
                type="tel"
                pattern="[0-9]{10}"
                placeholder="10-digit number (optional)"
                className="h-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Default rate per can</Label>
              <Select value={rate} onValueChange={setRate}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      ₹{r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-open">Opening pending (₹)</Label>
              <Input
                id="c-open"
                inputMode="numeric"
                className="h-11"
                placeholder="0"
                value={opening}
                onChange={(e) => setOpening(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-open-cans">Opening cans with them</Label>
              <Input
                id="c-open-cans"
                inputMode="numeric"
                className="h-11"
                placeholder="0"
                value={openingCans}
                onChange={(e) => setOpeningCans(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-notes">Notes (optional)</Label>
            <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="h-11 w-full" onClick={save}>
            Save customer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomersPage() {
  const data = useData();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = filterCustomersByAlphabet(data.customers, q);
    return list.map((c) => ({ c, pending: pendingFor(data, c) }));
  }, [data, q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <AddCustomerDialog />
      </div>

      <Input
        className="mt-5 h-11"
        placeholder="Search company..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 text-right font-medium">Pending</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, pending }) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.contact || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{rupees(pending)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/customers/$id"
                    params={{ id: c.id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No customers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PageNav current="/customers" />
    </div>
  );
}
