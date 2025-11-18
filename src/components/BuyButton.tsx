"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BuyButtonProps {
  priceId?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
}

export default function BuyButton({
  priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
  successUrl,
  cancelUrl,
  metadata = { uid: "DEV_UID_123" }, // TODO: Get from auth
  children = "Subscribe Now | اشترك الآن",
  className = "w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-6 text-lg",
  variant = "default",
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Creating checkout session...");

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          successUrl,
          cancelUrl,
          metadata,
        }),
      });

      const data = await response.json();

      if (data.ok && data.url) {
        console.log("Redirecting to Stripe checkout...");
        window.location.href = data.url;
      } else {
        console.error("Error creating checkout:", data.error);
        setError(data.error || "Failed to create checkout session");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={loading}
        className={className}
        variant={variant}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          children
        )}
      </Button>
      {error && (
        <p className="text-red-400 text-sm mt-2">
          {error}
        </p>
      )}
    </div>
  );
}


