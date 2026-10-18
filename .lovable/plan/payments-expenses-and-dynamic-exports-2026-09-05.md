# Payments, Expenses, and Dynamic Exports

## User outcome
- A Payments page lists every company, shows what is currently owed, and lets the user record a payment without leaving the list.
- An Expenses page records one day at a time: diesel from ₹300/₹400/₹500/₹600 or nil, plus an optional snacks and food amount or nil.
- Excel export follows the selected company, uses that company’s name in the filename, and includes the relevant expense rows.

## Implementation
1. Extend the local ledger data model with expense entries and persistence helpers while preserving existing customer transactions.
2. Add Payments navigation and page UI using the existing payment form/dialog patterns; refresh pending totals immediately after saving.
3. Add Expenses navigation and page UI with a date field, diesel selector, snacks/food amount input, save/update behavior for the selected date, and a day-wise history list.
4. Update export generation to use the selected company’s actual name/data, keep all-company export behavior, and add expense rows in a clearly labeled section.
5. Update page navigation and route metadata, then verify the new pages and export behavior in the running preview.

## Technical notes
- Keep the existing local-storage store and semantic design tokens.
- Reuse existing Button, Input, Label, Select, Dialog, and toast components.
- Keep expenses separate from customer balances so they do not change customer pending amounts.
- Use type-safe TanStack Router links and add route files before linking to them.
