'use client';
import { useMemo } from 'react';
export function useCurrency(){ return { code:'USD', rate:1 }; }
export default function CurrencySwitcher(){
  const c = useCurrency();
  return <div style={{opacity:.6}}>Currency: {c.code}</div>;
}
