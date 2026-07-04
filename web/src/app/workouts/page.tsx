"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { createWorkout, deleteWorkout, listWorkouts } from "@/lib/api";
import type { Workout } from "@/lib/types";
import { btnAccent, btnPrimary, cardPad, input, pageSubtitle, pageTitle } from "@/lib/ui";

type DraftSet = { reps?: number; weightLbs?: number; durationSeconds?: number; distanceMiles?: number };
type DraftExercise = { name: string; exerciseType: string; sets: DraftSet[] };

const inputSm = `${input} px-2 py-1`;

function Inner() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => listWorkouts().then(setWorkouts).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  const addExercise = () =>
    setExercises([...exercises, { name: "", exerciseType: "strength", sets: [{}] }]);

  const updateExercise = (i: number, patch: Partial<DraftExercise>) => {
    const next = [...exercises];
    next[i] = { ...next[i], ...patch };
    setExercises(next);
  };

  const addSet = (ei: number) => {
    const next = [...exercises];
    next[ei].sets = [...next[ei].sets, {}];
    setExercises(next);
  };

  const updateSet = (ei: number, si: number, patch: Partial<DraftSet>) => {
    const next = [...exercises];
    next[ei].sets[si] = { ...next[ei].sets[si], ...patch };
    setExercises(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createWorkout({
        name: name || undefined,
        startedAt: new Date().toISOString(),
        notes: notes || undefined,
        exercises: exercises.map((ex, i) => ({
          name: ex.name,
          exerciseType: ex.exerciseType,
          sortOrder: i,
          sets: ex.sets.map((s, j) => ({ setNumber: j + 1, ...s })),
        })),
      });
      setName(""); setNotes(""); setExercises([]);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Workouts</h1>
        <p className={pageSubtitle}>Build a session exercise by exercise, then save it.</p>
      </div>

      <form onSubmit={submit} className={`${cardPad} space-y-3`}>
        <input
          placeholder="Workout name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${input} w-full`}
        />
        <textarea
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${input} w-full`}
          rows={2}
        />

        <div className="space-y-3">
          {exercises.map((ex, ei) => (
            <div key={ei} className="space-y-2 rounded-xl border border-white/[0.06] bg-gray-950/40 p-3">
              <div className="flex gap-2">
                <input
                  placeholder="Exercise name"
                  value={ex.name}
                  onChange={(e) => updateExercise(ei, { name: e.target.value })}
                  required
                  className={`${inputSm} flex-1`}
                />
                <select
                  value={ex.exerciseType}
                  onChange={(e) => updateExercise(ei, { exerciseType: e.target.value })}
                  className={inputSm}
                >
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="mobility">Mobility</option>
                </select>
              </div>
              {ex.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-2 text-sm">
                  <span className="w-6 tabular-nums text-gray-500">#{si + 1}</span>
                  <input
                    type="number" placeholder="reps"
                    value={s.reps ?? ""}
                    onChange={(e) => updateSet(ei, si, { reps: e.target.value ? +e.target.value : undefined })}
                    className={`${inputSm} w-20`}
                  />
                  <input
                    type="number" step="0.5" placeholder="lbs"
                    value={s.weightLbs ?? ""}
                    onChange={(e) => updateSet(ei, si, { weightLbs: e.target.value ? +e.target.value : undefined })}
                    className={`${inputSm} w-24`}
                  />
                  <input
                    type="number" placeholder="seconds"
                    value={s.durationSeconds ?? ""}
                    onChange={(e) => updateSet(ei, si, { durationSeconds: e.target.value ? +e.target.value : undefined })}
                    className={`${inputSm} w-24`}
                  />
                  <input
                    type="number" step="0.1" placeholder="miles"
                    value={s.distanceMiles ?? ""}
                    onChange={(e) => updateSet(ei, si, { distanceMiles: e.target.value ? +e.target.value : undefined })}
                    className={`${inputSm} w-24`}
                  />
                </div>
              ))}
              <button type="button" onClick={() => addSet(ei)} className={btnAccent}>
                + Set
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={addExercise} className={btnAccent}>
            + Exercise
          </button>
          <button className={`${btnPrimary} ml-auto`}>Save workout</button>
        </div>
      </form>

      {err && <div className="text-sm text-red-400">{err}</div>}

      <div className="space-y-3">
        {workouts.map((w) => (
          <div key={w.id} className={`${cardPad} transition-colors hover:border-white/10`}>
            <div className="flex justify-between">
              <div>
                <div className="font-medium text-gray-100">{w.name ?? "Workout"}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {new Date(w.startedAt).toLocaleString()}
                  {w.durationMinutes ? ` · ${w.durationMinutes} min` : ""}
                </div>
              </div>
              <button
                onClick={async () => { await deleteWorkout(w.id); refresh(); }}
                className="self-start text-sm text-gray-500 transition-colors hover:text-red-400"
              >
                Delete
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {w.exercises.map((ex) => (
                <li key={ex.id}>
                  <span className="font-medium text-gray-200">{ex.name}</span>{" "}
                  <span className="text-gray-500">
                    ({ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {workouts.length === 0 && (
          <div className="text-sm text-gray-500">No workouts yet.</div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}
