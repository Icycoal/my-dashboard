import type { PlaidAccount, Transaction } from '@/lib/finances-types';
import { healthRequest } from '@/lib/api';

export async function createLinkToken(): Promise<string> {
  const data = await healthRequest<{ link_token: string }>('plaid/create-link-token', { method: 'POST' });
  return data.link_token;
}

export async function exchangeToken(
  publicToken: string,
  institutionId: string,
  institutionName: string,
  accounts: { id: string; name: string; type: string; subtype: string | null; mask: string | null }[]
): Promise<PlaidAccount> {
  return healthRequest<PlaidAccount>('plaid/exchange-token', {
    method: 'POST',
    body: JSON.stringify({
      public_token: publicToken,
      institution_id: institutionId,
      institution_name: institutionName,
      accounts,
    }),
  });
}

export async function fetchConnectedAccounts(): Promise<PlaidAccount[]> {
  return healthRequest<PlaidAccount[]>('plaid/accounts');
}

export async function syncTransactions(): Promise<{
  transactions: Transaction[];
  syncedAt: string;
  cashBalance: number | null;
}> {
  return healthRequest('plaid/sync', { method: 'POST' });
}

export async function removeAccount(id: string): Promise<void> {
  await healthRequest<void>(`plaid/account/${id}`, { method: 'DELETE' });
}
