import { useEffect, useState } from "react";

/** Qiymat o'zgarishini kechiktirish — yozish paytida har harfda so'rov yubormaslik uchun. */
export function useDebounced<V>(value: V, ms = 250): V {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
