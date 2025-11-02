
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
    const storedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (storedCurrency && currencies.some(c => c.symbol === storedCurrency)) {
      setSelectedCurrencySymbol(storedCurrency);
    }
  }, []);
  
  useEffect(() => {
    async function fetchRates() {
      setLoading(true);
      try {
        // We only need the rate for USD to calculate others
        const priceData = await getLivePrices(['USDT'], selectedCurrencySymbol);
        const usdToSelectedRate = priceData['USDT'];
        
        if (usdToSelectedRate) {
          setRates({ [selectedCurrencySymbol]: usdToSelectedRate, USD: 1 });
        } else {
           // Fallback if the direct rate isn't available
           setRates({ [selectedCurrencySymbol]: 1, USD: 1 });
        }

      } catch (error) {
        console.error("Failed to fetch currency conversion rates:", error);
        setRates({ [selectedCurrencySymbol]: 1, USD: 1 }); // Fallback
      }
      setLoading(false);
    }

    if (selectedCurrencySymbol === 'USD') {
        setRates({ USD: 1 });
        setLoading(false);
    } else {
        fetchRates();
    }
  }, [selectedCurrencySymbol]);


  const setCurrency = (symbol: string) => {
    const newCurrency = currencies.find(c => c.symbol === symbol);
    if (newCurrency) {
      setSelectedCurrencySymbol(symbol);
      localStorage.setItem(CURRENCY_STORAGE_KEY, symbol);
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
    const rate = rates[selectedCurrencySymbol] ?? (selectedCurrencySymbol === 'USD' ? 1 : 0);
    return { ...current, rate };
  }, [selectedCurrencySymbol, rates]);

  const value = {
    currency,
    setCurrency,
    formatCurrency,
    rates,
    loading
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
