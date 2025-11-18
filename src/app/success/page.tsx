"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/checkout?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSession(data.session);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching session:", err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-cyan-500/30 bg-slate-900/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="p-4 rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/30">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </div>
          </div>
          <CardTitle className="text-3xl text-white">
            Payment Successful! 🎉
            <br />
            <span className="text-2xl">الدفع تم بنجاح!</span>
          </CardTitle>
          <CardDescription className="text-slate-400 text-lg mt-4">
            Your subscription is now active
            <br />
            <span className="text-sm">اشتراكك الآن نشط</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center text-slate-400">
              Loading...
            </div>
          ) : session ? (
            <>
              <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <p className="text-lg font-semibold text-cyan-400">
                    29 FZ Credits Added!
                  </p>
                </div>
                <p className="text-sm text-slate-300">
                  Your account has been credited with 29 FZ credits. You can now use them to power your AI development tasks.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  تم إضافة 29 رصيد FZ إلى حسابك. يمكنك الآن استخدامها في مهام التطوير بالذكاء الاصطناعي.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white">{session.customer_email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount:</span>
                  <span className="text-white">
                    ${((session.amount_total || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-green-400 capitalize">{session.payment_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Session ID:</span>
                  <span className="text-slate-300 text-xs font-mono">
                    {session.id.substring(0, 20)}...
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => (window.location.href = "/api/me")}
                  variant="outline"
                  className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  Check Balance
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-slate-400 mb-4">
                Thank you for your subscription!
                <br />
                شكراً لاشتراكك!
              </p>
              <Button
                onClick={() => (window.location.href = "/pricing")}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
              >
                Back to Pricing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}


