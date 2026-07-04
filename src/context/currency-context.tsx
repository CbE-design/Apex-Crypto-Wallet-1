
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { currencies } from '@/lib/currencies';
import type { Currency } from '@/lib/types';

interface CurrencyContextType {
  currency: Currency & { rate: number };
  setCurrency: (symbol: string) => void;
  formatCurrency: (value: number) => string;
  rates: Record<string, number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const CURRENCY_STORAGE_KEY = 'apex-selected-currency';

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState<string>('USD');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && currencies.some(c => c.symbol === stored)) {
      setSelectedCurrencySymbol(stored);
    }
  }, []);

  useEffect(() => {
    async function fetchRates() {
      setLoading(true);
      try {
        const response = await fetch('https://api.frankfurter.app/latest?from=USD');
        const data = await response.json();
        setRates({ ...data.rates, USD: 1 });
      } catch (error) {
        console.error("Failed to fetch currency rates:", error);
        // Fallback to USD if API fails
        setRates({ USD: 1 });
      } finally {
        setLoading(false);
      }
    }
    fetchRates();
  }, []);

  const setCurrency = useCallback((symbol: string) => {
    if (currencies.some(c => c.symbol === symbol)) {
      setSelectedCurrencySymbol(symbol);
      localStorage.setItem(CURRENCY_STORAGE_KEY, symbol);
    }
  }, []);

  const formatCurrency = useCallback((value: number) => {
    const rate = rates[selectedCurrencySymbol] || 1;
    const convertedValue = value * rate;
    
    const selectedCurrency = currencies.find(c => c.symbol === selectedCurrencySymbol) || currencies.find(c => c.symbol === 'USD');

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrencySymbol,
      minimumFractionDigits: selectedCurrency?.digits,
      maximumFractionDigits: selectedCurrency?.digits,
    }).format(convertedValue);
  }, [selectedCurrencySymbol, rates]);

  const currency = useMemo(() => {
    const base = currencies.find(c => c.symbol === selectedCurrencySymbol) || currencies.find(c => c.symbol === 'USD')!;
    return {
      ...base,
      rate: rates[selectedCurrencySymbol] || 1,
    };
  }, [selectedCurrencySymbol, rates]);

  const value = {
    currency,
    setCurrency,
    formatCurrency,
    rates,
    loading
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
