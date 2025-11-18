"use client";

import { CheckCircle2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BuyButton from "@/components/BuyButton";

export default function PricingPage() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
            Pricing | التسعير
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Simple, transparent pricing. Start building with F0 today.
            <br />
            <span className="text-sm">تسعير بسيط وشفاف. ابدأ البناء مع F0 اليوم.</span>
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-md mx-auto">
          <Card className="border-cyan-500/30 bg-slate-900/50 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="p-3 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                  <Zap className="w-8 h-8 text-cyan-400" />
                </div>
              </div>
              <CardTitle className="text-3xl text-white">Pro Plan</CardTitle>
              <CardDescription className="text-slate-400">
                خطة احترافية | Professional Plan
              </CardDescription>
              <div className="mt-6">
                <span className="text-5xl font-bold text-white">$29</span>
                <span className="text-slate-400">/month</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">29 FZ Credits</p>
                    <p className="text-sm text-slate-400">رصيد 29 FZ شهرياً</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">AI-Powered Development</p>
                    <p className="text-sm text-slate-400">تطوير مدعوم بالذكاء الاصطناعي</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Firebase Integration</p>
                    <p className="text-sm text-slate-400">تكامل Firebase</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Stripe Payments</p>
                    <p className="text-sm text-slate-400">مدفوعات Stripe</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Priority Support</p>
                    <p className="text-sm text-slate-400">دعم ذو أولوية</p>
                  </div>
                </div>
              </div>

              {/* FZ Recharge Info */}
              <div className="mt-6 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <p className="text-sm font-semibold text-cyan-400">FZ Credits</p>
                </div>
                <p className="text-xs text-slate-300">
                  Your FZ balance recharges automatically each month. Use FZ credits to power your AI development tasks.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  رصيد FZ يتجدد تلقائياً كل شهر. استخدم رصيد FZ لتشغيل مهام التطوير بالذكاء الاصطناعي.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <BuyButton
                metadata={{
                  uid: "DEV_UID_123", // TODO: Replace with actual user ID from auth
                }}
              />
            </CardFooter>
          </Card>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Need More Credits? | تحتاج المزيد من الرصيد؟
            </h2>
            <p className="text-slate-400 mb-6">
              Contact us for enterprise plans and custom pricing.
              <br />
              <span className="text-sm">تواصل معنا للحصول على خطط مؤسسية وتسعير مخصص.</span>
            </p>
            <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
