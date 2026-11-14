"use client";
import { useCallback, useEffect, useRef } from "react";

/** Request completion renders immediately; closed or unmounted views ignore late results. */
export function useRequestScope() {
  const sequence = useRef(0);
  const cancel = useCallback(() => { sequence.current++; }, []);
  const start = useCallback(() => {
    const request = ++sequence.current;
    return () => request === sequence.current;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { start, cancel };
}
