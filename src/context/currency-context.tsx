'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { currencies } from '@/lib/currencies';
import type { Currency } from '@/lib/types';

// Define a default, server-safe value for the context
const defaultCurrency = currencies.find(c => c.symbol === 'USD')!;
const defaultContextValue: CurrencyContextType = {
  currency: { ...defaultCurrency, rate: 1 },
  setCurrency: () => console.warn('Currency context not yet mounted'),
  formatCurrency: (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value),
  rates: { USD: 1 },
  loading: true,
};

interface CurrencyContextType {
  currency: Currency & { rate: number };
  setCurrency: (symbol: string) => void;
  formatCurrency: (value: number) => string;
  rates: Record<string, number>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType>(defaultContextValue);
const CURRENCY_STORAGE_KEY = 'apex-selected-currency';

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState<string>('USD');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This effect runs only on the client after the component has mounted.
    setIsMounted(true);

    // 1. Get stored currency preference
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && currencies.some(c => c.symbol === stored)) {
      setSelectedCurrencySymbol(stored);
    }

    // 2. Fetch latest currency rates
    async function fetchRates() {
      setLoading(true);
      try {
        const response = await fetch('/api/rates');
        if (!response.ok) throw new Error('Failed to fetch');
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
  }, []); // Empty dependency array ensures this runs only once on mount.

  const setCurrency = useCallback((symbol: string) => {
    if (currencies.some(c => c.symbol === symbol)) {
      setSelectedCurrencySymbol(symbol);
      localStorage.setItem(CURRENCY_STORAGE_KEY, symbol);
    }
  }, []);

  const currency = useMemo(() => {
    const base = currencies.find(c => c.symbol === selectedCurrencySymbol) || defaultCurrency;
    return {
      ...base,
      rate: rates[selectedCurrencySymbol] || 1,
    };
  }, [selectedCurrencySymbol, rates]);

  const formatCurrency = useCallback((value: number) => {
    const convertedValue = value * currency.rate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.symbol,
    }).format(convertedValue);
  }, [currency]);

  // While not mounted, we return the default server-safe value
  // to ensure server render and initial client render are identical.
  if (!isMounted) {
    return (
      <CurrencyContext.Provider value={defaultContextValue}>
        {children}
      </CurrencyContext.Provider>
    );
  }

  const value = {
    currency,
    setCurrency,
    formatCurrency,
    rates,
    loading,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  // The context is now guaranteed to be defined because of the default value.
  return context;
};
