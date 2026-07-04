import { useState, useCallback } from 'react';
import { useFinance } from '@/lib/FinanceProvider';
import { fetchFilings, fetchHoldings } from '@/lib/finances/api';
import { clientAlgorithmConfig } from '@/lib/clientSettings';
import type { AlgorithmCache, ManagerFilingData, ThirteenFHolding } from '@/lib/finances-types';

export interface FetchProgress {
  current: number;
  total: number;
  label: string;
}

export function useAlgorithmFetch() {
  const { dispatch } = useFinance();
  const [fetching, setFetching] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setFetching(true);
    setError(null);

    const { curatedManagers, filingsPerManager, fetchBatchSize, fetchBatchDelayMs } = clientAlgorithmConfig();
    const managers: ManagerFilingData[] = [];
    const totalSteps = curatedManagers.length * 2;
    let step = 0;

    try {
      for (let i = 0; i < curatedManagers.length; i += fetchBatchSize) {
        const batch = curatedManagers.slice(i, i + fetchBatchSize);

        if (i > 0) {
          await new Promise(r => setTimeout(r, fetchBatchDelayMs));
        }

        const filingResults = await Promise.all(
          batch.map(async (mgr) => {
            setProgress({ current: ++step, total: totalSteps, label: `Fetching ${mgr.name} filings...` });
            const filings = await fetchFilings(mgr.cik, filingsPerManager);
            return { mgr, filings };
          })
        );

        await new Promise(r => setTimeout(r, fetchBatchDelayMs));

        // Fetch holdings for each filing
        for (const { mgr, filings } of filingResults) {
          setProgress({ current: ++step, total: totalSteps, label: `Fetching ${mgr.name} holdings...` });
          const holdings: Record<string, ThirteenFHolding[]> = {};

          for (const filing of filings) {
            try {
              const holdingsList = await fetchHoldings(mgr.cik, filing.accession);
              holdings[filing.accession] = holdingsList;
              await new Promise(r => setTimeout(r, 200)); // small delay between calls
            } catch {
              // Skip failed individual holdings fetches
              holdings[filing.accession] = [];
            }
          }

          managers.push({
            cik: mgr.cik,
            name: mgr.name,
            filings,
            holdings,
          });
        }
      }

      const cache: AlgorithmCache = {
        fetchedAt: new Date().toISOString(),
        managers,
      };

      dispatch({ type: 'SET_ALGORITHM_CACHE', cache });
      setProgress(null);
      setFetching(false);
      return cache;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
      setFetching(false);
      setProgress(null);
      return null;
    }
  }, [dispatch]);

  return { fetchAll, fetching, progress, error };
}
