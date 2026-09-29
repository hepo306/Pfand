import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAccount } from "../components/account";
import { fetchEvent, type EventAccount } from "./pfand";

export function parseKey(s: string | undefined): PublicKey | null {
  if (!s) return null;
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

/** Loads an event and keeps it fresh while the page is open. */
export function useEvent(eventKey: PublicKey | null, pollMs = 5000) {
  const { program } = useAccount();
  const [event, setEvent] = useState<EventAccount | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!eventKey) {
      setEvent(null);
      return;
    }
    try {
      setEvent(await fetchEvent(program, eventKey));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [program, eventKey]);

  usePoll(reload, pollMs);

  return { event, error, reload };
}

/** Re-render every `ms` so time-based states (cancel deadline, start, end) update. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function relative(targetSecs: number, now: number): string {
  const d = Math.round(targetSecs - now);
  const abs = Math.abs(d);
  const fmt =
    abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.round(abs / 60)} min` : abs < 86400 ? `${Math.round(abs / 3600)} h` : `${Math.round(abs / 86400)} days`;
  return d >= 0 ? `in ${fmt}` : `${fmt} ago`;
}

/**
 * Calls `fn` now and then again `ms` after each run finishes. Never overlaps
 * runs, so a slow or rate-limited RPC can't pile up requests.
 */
export function usePoll(fn: () => Promise<unknown>, ms: number) {
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        await fn();
      } catch {
        /* keep polling */
      }
      if (alive) timer = setTimeout(tick, document.hidden ? ms * 3 : ms);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fn, ms]);
}
