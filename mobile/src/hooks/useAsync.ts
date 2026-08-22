import { useCallback, useEffect, useRef, useState } from "react";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

/** Fetch-on-mount (and on deps change) with a manual refetch — used by every screen
 * so pull-to-refresh and re-navigation always show the live API state, not a stale
 * cached render. `deps` should be simple primitives (a slug, a country code) — they're
 * serialized to key the effect, since a spread dependency array can't be statically
 * checked by the linter. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const depsKey = JSON.stringify(deps);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Something went wrong" });
    }
    // depsKey is the intentional re-run key (see doc comment above); fnRef sidesteps
    // needing fn itself as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, tick]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
