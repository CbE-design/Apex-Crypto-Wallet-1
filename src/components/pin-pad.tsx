'use client';

import React from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinPadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  disabled?: boolean;
  error?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({ value, onChange, maxLength = 6, disabled = false, error = false }: PinPadProps) {
  const handleKey = (k: string) => {
    if (disabled) return;
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (k && value.length < maxLength) {
      onChange(value + k);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Dot display */}
      <div className="flex items-center gap-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full border-2 transition-all duration-150',
              i < value.length
                ? error
                  ? 'bg-destructive border-destructive scale-110'
                  : 'bg-primary border-primary scale-110'
                : 'bg-transparent border-border/60',
            )}
          />
        ))}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[260px]">
        {KEYS.map((k, i) => {
          if (!k) {
            return <div key={i} />;
          }
          if (k === 'del') {
            return (
              <button
                key={i}
                onClick={() => handleKey('del')}
                disabled={disabled || value.length === 0}
                className={cn(
                  'flex items-center justify-center h-14 rounded-2xl',
                  'bg-muted/40 border border-border/30 text-muted-foreground',
                  'hover:bg-muted/70 hover:text-foreground active:scale-95',
                  'transition-all duration-100 disabled:opacity-30',
                )}
              >
                <Delete className="h-4 w-4" />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleKey(k)}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center h-14 rounded-2xl',
                'bg-muted/40 border border-border/30',
                'hover:bg-primary/10 hover:border-primary/30 hover:text-primary',
                'active:scale-95 active:bg-primary/20',
                'transition-all duration-100 disabled:opacity-30',
                'text-lg font-semibold text-foreground',
              )}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
