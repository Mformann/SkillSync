import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export function nextCursor(headers: { [key: string]: unknown } | undefined): number | null {
  const value = Number(headers?.["x-next-cursor"]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** One bounded page per action; retries preserve visible rows. */
export function usePagedList<T>(url: string, key: keyof T) {
  const [data, setData] = useState<T[]>();
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  const fetchPage = useCallback(async (before: number | null, reset = false) => {
    if (busy.current && !reset) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    busy.current = true; setLoading(true); setError("");
    try {
      const response = await api.get<T[]>(url, { signal: controller.signal,
        ...(before ? { params: { before_id: before } } : {}) });
      if (controller.signal.aborted) return;
      setData(previous => {
        const items = reset ? [] : previous || [];
        const seen = new Set(items.map(item => item[key]));
        return [...items, ...response.data.filter(item => !seen.has(item[key]))];
      });
      setCursor(nextCursor(response.headers));
    } catch {
      if (!controller.signal.aborted) setError("Could not load items. Please try again.");
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [url, key]);
  useEffect(() => {
    setData(undefined); setCursor(null);
    void fetchPage(null, true);
    return () => { request.current?.abort(); busy.current = false; };
  }, [fetchPage, version]);
  const loadMore = () => { if (cursor) void fetchPage(cursor); };
  return { data, error, loading, reload, loadMore, hasMore: cursor !== null };
}
