import { useState, useEffect, useCallback } from "react";

export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs = 5000,
  initialData: T | [] = [] as T,
) {
  const [data, setData] = useState<T | []>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  // Site-local clock strings (no Z) — show the wall time as stored.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !iso.endsWith("Z")) {
    const [date, time] = iso.replace("Z", "").split("T");
    const hhmm = time.slice(0, 5);
    const [, mo, d] = date.split("-");
    return `${d}/${mo} ${hhmm}`;
  }
  return new Date(iso).toLocaleString();
}

export function secondsUntil(iso: string) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
