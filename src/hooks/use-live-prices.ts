'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface LivePriceData {
  prices: Record<string, number>;
  changes: Record<string, number>;
}

export function useLivePrices(symbols: string[], currency: string = 'USD', intervalMs: number = 60000) {
  const [data, setData] = useState<LivePriceData>({ prices: {}, changes: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const symbolsKey = symbols.sort().join(',');
  const requestCount = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = useCallback(async (isInitial = false) => {
    if (symbols.length === 0) {
      setIsLoading(false);
      return;
    }

    const currentRequest = ++requestCount.current;
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);
    
    setError(null);

    try {
      const res = await fetch(
        `/api/prices?symbols=${symbolsKey}&currency=${currency}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        throw new Error(`Price fetch failed with status ${res.status}`);
      }
      const result = await res.json() as LivePriceData;
      
      if (currentRequest === requestCount.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (e: any) {
      if (currentRequest === requestCount.current) {
        setError(e);
      }
    } finally {
      if (currentRequest === requestCount.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [symbolsKey, currency]);

  useEffect(() => {
    fetchPrices(true);

    if (timerRef.current) clearInterval(timerRef.current);
    
    if (intervalMs > 0) {
      timerRef.current = setInterval(() => fetchPrices(false), intervalMs);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchPrices, intervalMs]);

  const refresh = useCallback(() => fetchPrices(false), [fetchPrices]);

  return { ...data, isLoading, isRefreshing, error, lastUpdated, refresh };
}
