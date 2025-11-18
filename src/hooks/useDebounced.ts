import { useEffect, useState } from "react";

/**
 * useDebounced - Debounces a value to reduce unnecessary updates
 *
 * Delays updating the returned value until the input value has been stable
 * for the specified delay period. Useful for:
 * - Search inputs (wait for user to stop typing)
 * - Filter changes (avoid hammering the API)
 * - Expensive computations (defer until value stabilizes)
 *
 * @param value - The value to debounce
 * @param delay - Milliseconds to wait (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const searchTerm = useDebounced(inputValue, 500);
 * // API call only fires after user stops typing for 500ms
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
}
