'use client';

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currencies } from "@/lib/currencies";
import { useCurrency } from "@/context/currency-context";

export function CurrencySwitcher() {
  const [open, setOpen] = React.useState(false);
  const { currency, setCurrency, loading } = useCurrency();

  if (loading) {
    return <Button variant="outline" className="w-24 justify-start">Loading...</Button>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-24 justify-start"
        >
          {currency.symbol}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search currency..." />
          <CommandEmpty>No currency found.</CommandEmpty>
          <CommandGroup>
            {currencies.map((c) => (
              <CommandItem
                key={c.symbol}
                value={c.symbol}
                onSelect={(currentValue) => {
                  setCurrency(currentValue.toUpperCase());
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    currency.symbol === c.symbol ? "opacity-100" : "opacity-0"
                  )}
                />
                {c.symbol} - {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
