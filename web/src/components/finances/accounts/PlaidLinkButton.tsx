import { useEffect, useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import type { PlaidLinkOnSuccess } from 'react-plaid-link';
import { createLinkToken, exchangeToken } from '@/lib/finances/plaidApi';
import type { PlaidAccount } from '@/lib/finances-types';

interface Props {
  onConnected: (account: PlaidAccount) => void;
}

export default function PlaidLinkButton({ onConnected }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken()
      .then(setLinkToken)
      .catch(e => setError(e.message));
  }, []);

  const onSuccess: PlaidLinkOnSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    setError(null);
    try {
      const accounts = (metadata.accounts ?? []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        mask: a.mask ?? null,
      }));
      const connected = await exchangeToken(
        publicToken,
        metadata.institution?.institution_id ?? '',
        metadata.institution?.name ?? 'Unknown',
        accounts,
      );
      onConnected(connected);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onConnected]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <div>
      <button
        onClick={() => open()}
        disabled={!ready || loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? 'Connecting…' : 'Connect Bank Account'}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
