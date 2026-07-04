import type {
  TokenResponse, WeightEntry, TrendPoint, Workout, FoodLog,
  USDAFoodSummary, DashboardSummary,
} from "./types";

const HEALTH_BASE = process.env.NEXT_PUBLIC_HEALTH_API ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080/api/v1";
const FINANCES_BASE = process.env.NEXT_PUBLIC_FINANCES_API ?? "http://127.0.0.1:8080/api/v1";
const TOKEN_KEY = "ht.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type ReqInit = RequestInit & { query?: Record<string, string | number> };

async function doRequest<T>(base: string, path: string, init: ReqInit = {}): Promise<T> {
  const url = new URL(`${base}/${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    throw new Error("Not logged in");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

async function request<T>(path: string, init: ReqInit = {}): Promise<T> {
  return doRequest<T>(HEALTH_BASE, path, init);
}

export async function financesRequest<T>(path: string, init: ReqInit = {}): Promise<T> {
  return doRequest<T>(FINANCES_BASE, path, init);
}

export async function healthRequest<T>(path: string, init: ReqInit = {}): Promise<T> {
  return doRequest<T>(HEALTH_BASE, path, init);
}

// Auth
export async function register(body: {
  name: string; email: string; password: string;
  phoneNumber?: string; timezone?: string;
}): Promise<TokenResponse> {
  const resp = await request<TokenResponse>("auth/register",
    { method: "POST", body: JSON.stringify(body) });
  setToken(resp.token);
  return resp;
}
export async function login(email: string, password: string): Promise<TokenResponse> {
  const resp = await request<TokenResponse>("auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) });
  setToken(resp.token);
  return resp;
}
export async function passwordLogin(password: string): Promise<TokenResponse> {
  const resp = await request<TokenResponse>("auth/password",
    { method: "POST", body: JSON.stringify({ password }) });
  setToken(resp.token);
  return resp;
}
export function logout() { setToken(null); }

// Weight
export const listWeights = () => request<WeightEntry[]>("weight");
export const createWeight = (weightLbs: number) =>
  request<WeightEntry>("weight", { method: "POST", body: JSON.stringify({ weightLbs }) });
export const deleteWeight = (id: string) =>
  request<void>(`weight/${id}`, { method: "DELETE" });
export const weightTrend = (days = 30) =>
  request<TrendPoint[]>("weight/trend", { query: { days } });

// Workouts
export const listWorkouts = () => request<Workout[]>("workouts");
export const createWorkout = (body: {
  name?: string; startedAt: string; notes?: string;
  exercises?: { name: string; exerciseType: string; sortOrder: number;
    sets: { setNumber: number; reps?: number; weightLbs?: number;
      durationSeconds?: number; distanceMiles?: number }[] }[];
}) => request<Workout>("workouts", { method: "POST", body: JSON.stringify(body) });
export const deleteWorkout = (id: string) =>
  request<void>(`workouts/${id}`, { method: "DELETE" });

// Food
export const searchFood = (query: string) =>
  request<USDAFoodSummary[]>("food/search", { query: { query } });
export const listFoodLogs = () => request<FoodLog[]>("food/logs");
export const createFoodLog = (body: {
  mealType?: string; loggedAt?: string; notes?: string; items: unknown[];
}) => request<FoodLog>("food/logs", { method: "POST", body: JSON.stringify(body) });

// Dashboard
export const dashboardSummary = () => request<DashboardSummary>("dashboard/summary");
