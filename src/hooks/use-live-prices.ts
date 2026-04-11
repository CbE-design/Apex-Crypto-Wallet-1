'use client';

import { useState, useEffect, useRef } from 'react';

export interface LivePriceData {
  prices: Record<string, number>;
  changes: Record<string, number>;
}

export function useLivePrices(symbols: string[]) {
  const [data, setData] = useState<LivePriceData>({ prices: {}, changes: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestCount = useRef(0);

  useEffect(() => {
    if (symbols.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchPrices = async (requestNumber: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/prices?symbols=${symbols.join(',')}&currency=USD`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          throw new Error(`Price fetch failed with status ${res.status}`);
        }
        const result = await res.json() as LivePriceData;
        if (requestNumber === requestCount.current) {
          setData(result);
        }
      } catch (e: any) {
        if (requestNumber === requestCount.current) {
          setError(e);
        }
      } finally {
        if (requestNumber === requestCount.current) {
          setIsLoading(false);
        }
      }
    };

    const currentRequest = ++requestCount.current;
    fetchPrices(currentRequest);

  }, [symbols]);

  return { ...data, isLoading, error };
}
