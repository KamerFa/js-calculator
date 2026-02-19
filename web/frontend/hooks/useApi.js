import { useState, useEffect, useCallback } from "react";
import { useAuthenticatedFetch } from "@shopify/app-bridge-react";

/**
 * Hook to make authenticated API calls to the app backend.
 */
export function useAppFetch() {
  const fetch = useAuthenticatedFetch();

  const appFetch = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || err.errors?.join(", ") || "Request failed");
      }

      return response.json();
    },
    [fetch]
  );

  return appFetch;
}

/**
 * Hook to fetch data on mount with loading/error states.
 */
export function useApiQuery(url) {
  const appFetch = useAppFetch();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await appFetch(url);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [appFetch, url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
