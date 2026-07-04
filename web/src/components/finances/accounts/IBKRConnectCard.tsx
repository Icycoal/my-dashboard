'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { financesRequest } from '@/lib/api';

interface IBKRStatus {
  gatewayReachable: boolean;
  authenticated: boolean;
  gatewayURL: string;
}

type State = 'checking' | 'not-running' | 'starting' | 'awaiting-login' | 'connected';

const GATEWAY_LOGIN_URL = 'http://localhost:5055';

async function fetchStatus(): Promise<IBKRStatus> {
  return financesRequest<IBKRStatus>('ibkr/status');
}

async function startGateway(): Promise<void> {
  await financesRequest<void>('ibkr/gateway/start', { method: 'POST' });
}

function StatusDot({ state }: { state: State }) {
  const colors: Record<State, string> = {
    connected:        'bg-emerald-400',
    'awaiting-login': 'bg-amber-400 animate-pulse',
    starting:         'bg-amber-400 animate-pulse',
    checking:         'bg-gray-600 animate-pulse',
    'not-running':    'bg-gray-600',
  };
  const labels: Record<State, string> = {
    connected:        'Connected',
    'awaiting-login': 'Awaiting login',
    starting:         'Starting…',
    checking:         'Checking…',
    'not-running':    'Not running',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${colors[state]}`} />
      <span className="text-xs text-gray-500">{labels[state]}</span>
    </div>
  );
}

export default function IBKRConnectCard() {
  const [connState, setConnState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCountRef = useRef(0);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const check = useCallback(async () => {
    try {
      const s = await fetchStatus();
      errorCountRef.current = 0;
      if (s.authenticated) {
        setConnState('connected');
        setError(null);
        stopPoll();
      } else if (s.gatewayReachable) {
        setConnState('awaiting-login');
      } else {
        setConnState('not-running');
        stopPoll();
      }
    } catch (e) {
      errorCountRef.current += 1;
      setError(e instanceof Error ? e.message : String(e));
      // Only give up after 3 consecutive failures — one bad response shouldn't kill polling
      if (errorCountRef.current >= 3) {
        setConnState('not-running');
        stopPoll();
      }
    }
  }, [stopPoll]);

  useEffect(() => {
    check();
    return stopPoll;
  }, [check, stopPoll]);

  const startPolling = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(check, 2500);
  }, [check, stopPoll]);

  // Auto-start polling whenever we enter awaiting-login (covers the case where
  // the gateway is already running on page load and the user signs in manually)
  useEffect(() => {
    if (connState === 'awaiting-login') {
      startPolling();
    }
  }, [connState, startPolling]);

  const handleStart = async () => {
    setConnState('starting');
    setError(null);
    try {
      await startGateway();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start gateway';
      setError(msg);
      setConnState('not-running');
      return;
    }
    // Give the gateway ~5 s to start, then open the login page
    setTimeout(() => {
      window.open(GATEWAY_LOGIN_URL, '_blank');
      setConnState('awaiting-login');
      startPolling();
    }, 5000);
  };

  const handleOpenLogin = () => {
    window.open(GATEWAY_LOGIN_URL, '_blank');
    setConnState('awaiting-login');
    startPolling();
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/40 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-gray-100">Interactive Brokers</div>
          <div className="mt-1 text-sm text-gray-500">Live portfolio · positions · P&L</div>
        </div>
        <StatusDot state={connState} />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          {error}
        </div>
      )}

      <div className="mt-4">
        {connState === 'connected' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span>Gateway authenticated — visit the</span>
            <a href="/finances/roth" className="underline underline-offset-2 hover:text-emerald-300">
              Investments page
            </a>
            <span>to sync portfolio data.</span>
          </div>
        )}

        {connState === 'awaiting-login' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenLogin}
              className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
            >
              Open Login Page
            </button>
            <span className="text-xs text-gray-600">Waiting for you to log in…</span>
          </div>
        )}

        {connState === 'not-running' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              The IBKR Client Portal Gateway needs to be running on this machine.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleStart}
                className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100"
              >
                Start & Connect
              </button>
              <button
                onClick={() => { errorCountRef.current = 0; setError(null); setConnState('checking'); check(); startPolling(); }}
                className="rounded-lg border border-white/[0.08] px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100"
              >
                Recheck
              </button>
            </div>
          </div>
        )}

        {connState === 'starting' && (
          <p className="text-sm text-gray-500">Starting gateway — login page will open in a moment…</p>
        )}

        {connState === 'checking' && (
          <p className="text-sm text-gray-600">Checking connection…</p>
        )}
      </div>
    </div>
  );
}
