"use client";

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react";
import type { FinanceState, FinanceAction, AppSettings } from "@/lib/finances-types";
import { healthRequest, getToken } from "@/lib/api";
import { initClientSettings, financeSettings } from "@/lib/clientSettings";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const defaultState: FinanceState = {
  activeYear: new Date().getFullYear(),
  creditCards: [],
  monthlyBills: [],
  recurringPayments: [],
  paychecks: [],
  transactions: [],
  currentBalance: 0,
  currentBalanceDate: todayISO(),
  payConfig: {
    hourlyRate: 0,
    hoursPerDay: 0,
    payDay: undefined,
    filingStatus: "single",
    traditional401k: 0,
    roth401k: 0,
    hsaMonthly: 0,
    rothIraMonthly: 0,
    employeeContrib401kPct: financeSettings().defaultEmployee401kPct,
    employerMatchPct: financeSettings().defaultEmployerMatchPct,
    ficaStartDate: "2027-10-01",
  },
  holidays: [],
  rothSnapshots: [],
  plaidAccounts: [],
  budgets: [],
  debts: [],
  contributions: [],
};

function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case "SET_YEAR":
      return { ...state, activeYear: action.year };
    case "ADD_CARD":
      return { ...state, creditCards: [...state.creditCards, action.card] };
    case "EDIT_CARD":
      return {
        ...state,
        creditCards: state.creditCards.map((c) => (c.id === action.card.id ? action.card : c)),
      };
    case "DELETE_CARD":
      return {
        ...state,
        creditCards: state.creditCards.filter((c) => c.id !== action.cardId),
        monthlyBills: state.monthlyBills.filter((b) => b.cardId !== action.cardId),
      };
    case "SET_BILL": {
      const exists = state.monthlyBills.find(
        (b) => b.cardId === action.bill.cardId && b.year === action.bill.year && b.month === action.bill.month,
      );
      if (exists) {
        return {
          ...state,
          monthlyBills: state.monthlyBills.map((b) =>
            b.cardId === action.bill.cardId && b.year === action.bill.year && b.month === action.bill.month
              ? action.bill
              : b,
          ),
        };
      }
      return { ...state, monthlyBills: [...state.monthlyBills, action.bill] };
    }
    case "ADD_RECURRING":
      return { ...state, recurringPayments: [...state.recurringPayments, action.payment] };
    case "DELETE_RECURRING":
      return { ...state, recurringPayments: state.recurringPayments.filter((r) => r.id !== action.id) };
    case "ADD_PAYCHECK":
      return { ...state, paychecks: [...state.paychecks, action.paycheck] };
    case "DELETE_PAYCHECK":
      return { ...state, paychecks: state.paychecks.filter((p) => p.id !== action.id) };
    case "ADD_TRANSACTION":
      return { ...state, transactions: [...state.transactions, action.transaction] };
    case "DELETE_TRANSACTION":
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case "SET_CURRENT_BALANCE":
      return { ...state, currentBalance: action.balance, currentBalanceDate: action.date };
    case "SET_PAY_CONFIG":
      return { ...state, payConfig: action.config };
    case "ADD_HOLIDAY":
      return { ...state, holidays: [...(state.holidays ?? []), action.holiday] };
    case "DELETE_HOLIDAY":
      return { ...state, holidays: (state.holidays ?? []).filter((h) => h.id !== action.id) };
    case "SET_HOLIDAYS":
      return { ...state, holidays: action.holidays };
    case "ADD_ROTH_SNAPSHOT":
      return { ...state, rothSnapshots: [action.snapshot, ...state.rothSnapshots] };
    case "DELETE_ROTH_SNAPSHOT":
      return { ...state, rothSnapshots: state.rothSnapshots.filter((s) => s.id !== action.id) };
    case "UPDATE_ROTH_PRICES": {
      return {
        ...state,
        rothSnapshots: state.rothSnapshots.map((snap) => {
          if (snap.id !== action.snapshotId) return snap;
          const updatedHoldings = snap.holdings.map((h) => {
            const quote = action.quotes[h.symbol];
            if (!quote) return h;
            const currentValue = h.quantity * quote.price;
            const gainLoss = currentValue - h.costBasis;
            const gainLossPercent = h.costBasis ? (gainLoss / h.costBasis) * 100 : 0;
            return {
              ...h,
              lastPrice: quote.price,
              currentValue,
              gainLoss,
              gainLossPercent: Math.round(gainLossPercent * 100) / 100,
            };
          });
          const totalValue = updatedHoldings.reduce((s, h) => s + h.currentValue, 0);
          const totalCostBasis = updatedHoldings.reduce((s, h) => s + h.costBasis, 0);
          const totalGainLoss = updatedHoldings.reduce((s, h) => s + h.gainLoss, 0);
          return {
            ...snap,
            holdings: updatedHoldings,
            totalValue,
            totalCostBasis,
            totalGainLoss,
            lastRefreshedAt: new Date().toISOString(),
          };
        }),
      };
    }
    case "UPDATE_HOLDING_COST_BASIS": {
      return {
        ...state,
        rothSnapshots: state.rothSnapshots.map((snap) => {
          if (snap.id !== action.snapshotId) return snap;
          const updatedHoldings = snap.holdings.map((h) => {
            if (h.symbol !== action.symbol) return h;
            const costBasis = action.costBasis;
            const gainLoss = h.currentValue - costBasis;
            const gainLossPercent = costBasis ? (gainLoss / costBasis) * 100 : 0;
            return {
              ...h,
              costBasis,
              gainLoss,
              gainLossPercent: Math.round(gainLossPercent * 100) / 100,
            };
          });
          const totalCostBasis = updatedHoldings.reduce((s, h) => s + h.costBasis, 0);
          const totalGainLoss = updatedHoldings.reduce((s, h) => s + h.gainLoss, 0);
          return { ...snap, holdings: updatedHoldings, totalCostBasis, totalGainLoss };
        }),
      };
    }
    case "SET_ALGORITHM_CACHE":
      return { ...state, algorithmCache: action.cache };
    case "SET_ALGORITHM_RESULT":
      return { ...state, algorithmResult: action.result };
    case "CLEAR_ALGORITHM_DATA":
      return { ...state, algorithmCache: undefined, algorithmResult: undefined };
    case "ADD_PLAID_ACCOUNT": {
      const existing = state.plaidAccounts ?? [];
      if (existing.some((a) => a.id === action.account.id)) {
        return {
          ...state,
          plaidAccounts: existing.map((a) => (a.id === action.account.id ? action.account : a)),
        };
      }
      return { ...state, plaidAccounts: [...existing, action.account] };
    }
    case "REMOVE_PLAID_ACCOUNT":
      return { ...state, plaidAccounts: (state.plaidAccounts ?? []).filter((a) => a.id !== action.id) };
    case "UPDATE_PLAID_ACCOUNT":
      return {
        ...state,
        plaidAccounts: (state.plaidAccounts ?? []).map((a) => (a.id === action.account.id ? action.account : a)),
      };
    case "SET_BUDGET": {
      const budgets = state.budgets ?? [];
      const exists = budgets.find((b) => b.id === action.budget.id);
      if (exists) {
        return { ...state, budgets: budgets.map((b) => (b.id === action.budget.id ? action.budget : b)) };
      }
      return { ...state, budgets: [...budgets, action.budget] };
    }
    case "DELETE_BUDGET":
      return { ...state, budgets: (state.budgets ?? []).filter((b) => b.id !== action.id) };
    case "ADD_DEBT":
      return { ...state, debts: [...(state.debts ?? []), action.debt] };
    case "EDIT_DEBT":
      return {
        ...state,
        debts: (state.debts ?? []).map((d) => (d.id === action.debt.id ? action.debt : d)),
      };
    case "DELETE_DEBT":
      return { ...state, debts: (state.debts ?? []).filter((d) => d.id !== action.id) };
    case "ADD_CONTRIBUTION":
      return { ...state, contributions: [...(state.contributions ?? []), action.contribution] };
    case "EDIT_CONTRIBUTION":
      return {
        ...state,
        contributions: (state.contributions ?? []).map((c) => (c.id === action.contribution.id ? action.contribution : c)),
      };
    case "DELETE_CONTRIBUTION":
      return { ...state, contributions: (state.contributions ?? []).filter((c) => c.id !== action.id) };
    case "SET_CONTRIBUTION_LIMIT":
      return {
        ...state,
        contributionLimits: {
          ...(state.contributionLimits ?? {}),
          [`${action.year}-${action.accountType}`]: action.limit,
        },
      };
    case "IMPORT_PLAID_TRANSACTIONS": {
      const existingIds = new Set(state.transactions.map((t) => t.plaidTransactionId).filter(Boolean));
      const newTxns = action.transactions.filter(
        (t) => !t.plaidTransactionId || !existingIds.has(t.plaidTransactionId),
      );
      return { ...state, transactions: [...state.transactions, ...newTxns] };
    }
    case "SET_REAL_ESTATE":
      return { ...state, realEstate: action.config };
    case "SET_SPEND_BUDGET":
      return { ...state, spendBudgetOverride: action.amount && action.amount > 0 ? action.amount : undefined };
    case "SET_BROKERAGE_PCT":
      return { ...state, brokerageMonthlyPct: action.pct > 0 ? action.pct : undefined };
    case "LOAD_STATE": {
      const loaded = { ...defaultState, ...action.state };
      loaded.payConfig = { ...defaultState.payConfig, ...action.state.payConfig };
      loaded.transactions = loaded.transactions.filter((t) => t.category !== "Transfer");
      return loaded;
    }
    default:
      return state;
  }
}

async function saveToBackend(state: FinanceState) {
  try {
    await healthRequest("finances/data", { method: "POST", body: JSON.stringify(state) });
  } catch {
    // server unreachable or unauthorized — ignore, auth guard handles redirect
  }
}

const FinanceContext = createContext<{
  state: FinanceState;
  dispatch: React.Dispatch<FinanceAction>;
} | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(financeReducer, defaultState);
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data: AppSettings | null) => { if (data) initClientSettings(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!getToken()) {
      loaded.current = true;
      return;
    }
    healthRequest<Partial<FinanceState>>("finances/data")
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          dispatch({ type: "LOAD_STATE", state: data as FinanceState });
        }
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    saveToBackend(state);
  }, [state]);

  return <FinanceContext.Provider value={{ state, dispatch }}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
