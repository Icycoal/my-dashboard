"use client";

import { useEffect, useState } from "react";
import { useFinance } from "@/lib/FinanceProvider";
import PlaidLinkButton from "@/components/finances/accounts/PlaidLinkButton";
import IBKRConnectCard from "@/components/finances/accounts/IBKRConnectCard";
import { fetchConnectedAccounts, syncTransactions, removeAccount } from "@/lib/finances/plaidApi";
import { computeBillsFromTransactions } from "@/lib/finances/billingCycle";
import type { PlaidAccount } from "@/lib/finances-types";

export default function AccountsPage() {
  const { state, dispatch } = useFinance();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accounts: PlaidAccount[] = state.plaidAccounts ?? [];

  useEffect(() => {
    fetchConnectedAccounts()
      .then((remote) => {
        for (const acct of remote) {
          const exists = accounts.find((a) => a.id === acct.id);
          if (!exists) dispatch({ type: "ADD_PLAID_ACCOUNT", account: acct });
          else dispatch({ type: "UPDATE_PLAID_ACCOUNT", account: acct });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const { transactions, syncedAt, cashBalance } = await syncTransactions();
      dispatch({ type: "IMPORT_PLAID_TRANSACTIONS", transactions });

      if (cashBalance != null) {
        dispatch({ type: "SET_CURRENT_BALANCE", balance: cashBalance, date: syncedAt.slice(0, 10) });
      }

      const allTxns = [...state.transactions, ...transactions];
      const bills = computeBillsFromTransactions(state.creditCards, allTxns);
      for (const bill of bills) dispatch({ type: "SET_BILL", bill });

      const existingIds = new Set(state.transactions.map((t) => t.plaidTransactionId).filter(Boolean));
      const newCount = transactions.filter(
        (t) => !t.plaidTransactionId || !existingIds.has(t.plaidTransactionId),
      ).length;

      const balanceNote =
        cashBalance != null
          ? ` · Balance updated to ${cashBalance.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
          : "";
      setSyncResult(
        `Imported ${newCount} new transaction${newCount !== 1 ? "s" : ""}${balanceNote} (synced ${new Date(syncedAt).toLocaleTimeString()})`,
      );

      const remote = await fetchConnectedAccounts();
      for (const acct of remote) dispatch({ type: "UPDATE_PLAID_ACCOUNT", account: acct });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await removeAccount(id);
      dispatch({ type: "REMOVE_PLAID_ACCOUNT", id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-10">

      {/* Brokerage */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Brokerage</h2>
          <p className="mt-0.5 text-sm text-gray-500">Live portfolio data from Interactive Brokers.</p>
        </div>
        <IBKRConnectCard />
      </div>

      {/* Bank accounts */}
      <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Connected Accounts</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Link your bank accounts to automatically import transactions.
          </p>
        </div>
        {accounts.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-white/[0.08] bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync Transactions"}
          </button>
        )}
      </div>

      {syncResult && (
        <div className="mb-4 rounded-lg border border-green-800/40 bg-green-900/20 px-4 py-2.5 text-sm text-green-300">
          {syncResult}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-gray-900/40 p-8 text-center">
          <p className="mb-4 text-sm text-gray-400">No bank accounts connected yet.</p>
          <PlaidLinkButton onConnected={(acct) => dispatch({ type: "ADD_PLAID_ACCOUNT", account: acct })} />
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => (
            <div key={acct.id} className="rounded-xl border border-white/[0.06] bg-gray-900/40 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-100">{acct.institutionName}</div>
                  <div className="mt-1 space-y-0.5">
                    {acct.accounts.map((a) => (
                      <div key={a.id} className="text-sm text-gray-400">
                        {a.name}
                        {a.mask ? ` ····${a.mask}` : ""}{" "}
                        <span className="text-gray-600 capitalize">{a.subtype ?? a.type}</span>
                      </div>
                    ))}
                  </div>
                  {acct.lastSynced && (
                    <div className="mt-2 text-xs text-gray-600">
                      Last synced {new Date(acct.lastSynced).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDisconnect(acct.id)}
                  className="rounded-md px-2.5 py-1 text-xs text-gray-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <PlaidLinkButton onConnected={(acct) => dispatch({ type: "ADD_PLAID_ACCOUNT", account: acct })} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
