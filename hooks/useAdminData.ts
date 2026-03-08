// hooks/useAdminData.ts
import { useEffect, useMemo, useState } from "react";

type Status = "idle" | "loading" | "success" | "error" | "refetching";

export function useAdminQuery<T>(key: string, fetcher: () => Promise<T>, refetchIntervalMs?: number) {
    const [status, setStatus] = useState<Status>("idle");
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const memoKey = useMemo(() => key, [key]);

    useEffect(() => {
        if (refetchIntervalMs && refetchIntervalMs > 0) {
            // Safety guard: prevent browser-killing 1ms loops
            const safeInterval = refetchIntervalMs < 1000 ? 5000 : refetchIntervalMs;
            const timer = setInterval(() => setTick(t => t + 1), safeInterval);
            return () => clearInterval(timer);
        }
    }, [refetchIntervalMs]);

    useEffect(() => {
        let alive = true;
        if (!data) setStatus("loading");
        else setStatus("refetching");
        setError(null);

        fetcher()
            .then((d) => {
                if (!alive) return;
                setData(d);
                setStatus("success");
            })
            .catch((e) => {
                if (!alive) return;
                setError(e?.message || String(e));
                setStatus("error");
            });

        return () => {
            alive = false;
        };
    }, [memoKey, tick]);

    return { status, data, error };
}
