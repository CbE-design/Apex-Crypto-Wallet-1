
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { currencies } from '@/lib/currencies';
import type { Currency } from '@/lib/types';
import { getLivePrices } from '@/services/crypto-service';

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
      if (selectedCurrencySymbol === 'USD') {
        setRates({ USD: 1 });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // getLivePrices now uses Frankfurter API for real fiat rates.
        // Fetching BTC in target currency lets us back-calculate the USD→target rate.
        const [btcInTarget, btcInUsd] = await Promise.all([
          getLivePrices(['BTC'], selectedCurrencySymbol),
          getLivePrices(['BTC'], 'USD'),
        ]);

        const targetPrice = btcInTarget['BTC'];
        const usdPrice = btcInUsd['BTC'];

        if (targetPrice && usdPrice && usdPrice > 0) {
          const derivedRate = targetPrice / usdPrice;
          setRates({ [selectedCurrencySymbol]: derivedRate, USD: 1 });
        } else {
          setRates({ [selectedCurrencySymbol]: 1, USD: 1 });
        }
      } catch {
        setRates({ [selectedCurrencySymbol]: 1, USD: 1 });
      }
      setLoading(false);
    }

    fetchRates();
  }, [selectedCurrencySymbol]);

  const setCurrency = (symbol: string) => {
    const found = currencies.find(c => c.symbol === symbol);
    if (found) {
      setSelectedCurrencySymbol(symbol);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CURRENCY_STORAGE_KEY, symbol);
      }
    }
  };

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrencySymbol,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, [selectedCurrencySymbol]);

  const currency = useMemo(() => {
    const current = currencies.find(c => c.symbol === selectedCurrencySymbol) || currencies[0];
    const rate = rates[selectedCurrencySymbol] ?? (selectedCurrencySymbol === 'USD' ? 1 : 1);
    return { ...current, rate };
  }, [selectedCurrencySymbol, rates]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency, rates, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};
