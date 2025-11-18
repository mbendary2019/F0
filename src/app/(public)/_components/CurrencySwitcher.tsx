"use client";
import { useEffect, useState } from "react";

const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" }
];

export default function CurrencySwitcher() {
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    // Load saved currency from localStorage
    const saved = localStorage.getItem("selectedCurrency");
    if (saved && SUPPORTED_CURRENCIES.find(c => c.code === saved)) {
      setCurrency(saved);
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent("currencyChanged", { detail: saved }));
    }
  }, []);

  const handleChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    localStorage.setItem("selectedCurrency", newCurrency);
    // Notify other components
    window.dispatchEvent(new CustomEvent("currencyChanged", { detail: newCurrency }));
    // Reload to update prices
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Currency:</label>
      <select
        value={currency}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-1.5 border rounded bg-white dark:bg-gray-800 text-sm"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code} - {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Hook for components to use selected currency
export function useCurrency() {
  const [currency, setCurrency] = useState("USD");
  const [symbol, setSymbol] = useState("$");

  useEffect(() => {
    const saved = localStorage.getItem("selectedCurrency") || "USD";
    setCurrency(saved);
    const found = SUPPORTED_CURRENCIES.find(c => c.code === saved);
    setSymbol(found?.symbol || "$");

    const handler = (e: CustomEvent) => {
      setCurrency(e.detail);
      const found = SUPPORTED_CURRENCIES.find(c => c.code === e.detail);
      setSymbol(found?.symbol || "$");
    };

    window.addEventListener("currencyChanged" as any, handler);
    return () => window.removeEventListener("currencyChanged" as any, handler);
  }, []);

  return { currency, symbol };
}
