'use client';

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currencies } from "@/lib/currencies";
import { useCurrency } from "@/context/currency-context";

function emojiToTwemojiUrl(emoji?: string) {
  if (!emoji) return null;
  // Convert emoji to codepoint(s) like '1f1fa-1f1f8' for flags
  const codePoints = Array.from(emoji).map(c => c.codePointAt(0)!.toString(16));
  const code = codePoints.join('-');
  return `https://twemoji.maxcdn.com/v/latest/svg/${code}.svg`;
}

function TwemojiFlag({ emoji, label, className = '' }: { emoji?: string; label?: string; className?: string }) {
  const [errored, setErrored] = React.useState(false);
  const url = emojiToTwemojiUrl(emoji) || undefined;

  if (!url || errored) {
    return (
      <span role="img" aria-label={label || 'flag'} className={cn('text-[14px] leading-none', className)}>
        {emoji || '🏳️'}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={label || ''}
      width={18}
      height={14}
      className={cn('object-cover rounded-sm', className)}
      onError={() => setErrored(true)}
    />
  );
}

export function CurrencySwitcher() {
  const [open, setOpen] = React.useState(false);
  const { currency, setCurrency, loading } = useCurrency();

  if (loading) {
    return <Button variant="outline" className="w-24 justify-start">Loading...</Button>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-28 justify-start">
          <div className="flex items-center gap-2 w-full">
            <TwemojiFlag emoji={currency.flag} label={currency.name} className="shrink-0" />
            <span className="font-medium text-sm">{currency.symbol}</span>
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </div>
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
                <Check className={cn("mr-2 h-4 w-4", currency.symbol === c.symbol ? "opacity-100" : "opacity-0")} />

                <div className="flex items-center gap-2">
                  <TwemojiFlag emoji={c.flag} label={c.name} className="shrink-0" />
                  <span className="truncate">{c.symbol} - {c.name}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
