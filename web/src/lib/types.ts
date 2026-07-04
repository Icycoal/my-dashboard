// Mirror backend DTOs

export interface TokenResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
}

export interface WeightEntry {
  id: string;
  weightLbs: number;
  loggedAt: string;
  source: string;
}

export interface TrendPoint {
  date: string;
  weightLbs: number;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  reps?: number;
  weightLbs?: number;
  durationSeconds?: number;
  distanceMiles?: number;
}

export interface Exercise {
  id: string;
  name: string;
  exerciseType: string;
  sortOrder: number;
  sets: ExerciseSet[];
}

export interface Workout {
  id: string;
  name?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  notes?: string;
  source: string;
  exercises: Exercise[];
}

export interface FoodItem {
  id: string;
  name: string;
  usdaFdcId?: number;
  servingSize?: number;
  servingUnit?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
}

export interface FoodLog {
  id: string;
  mealType?: string;
  loggedAt: string;
  notes?: string;
  source: string;
  totalCalories: number;
  items: FoodItem[];
}

export interface USDAFoodSummary {
  fdcId: number;
  name: string;
  brand?: string;
  servingSize?: number;
  servingUnit?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
}

export interface RecentWorkout {
  id: string;
  name?: string;
  startedAt: string;
  durationMinutes?: number;
  exerciseCount: number;
}

export interface DashboardSummary {
  todayCalories: number;
  todayProteinG: number;
  latestWeightLbs?: number;
  latestWeightDate?: string;
  recentWorkouts: RecentWorkout[];
}
