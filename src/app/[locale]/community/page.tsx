import { Metadata } from "next";
import CommunityBanner from "@/components/CommunityBanner";

export const metadata: Metadata = {
  title: "FZ Token — Community (Independent)",
  description: "Community-only informational page about FZ Token. Not affiliated for transacting.",
  robots: { index: false, follow: true }, // Change to true later if you want indexing
  openGraph: {
    title: "FZ Token — Community",
    description: "Independent community token page (informational only).",
    images: ["/assets/fz-token-og.png"],
  },
};

export default function CommunityPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "FZ Token — Community",
    description: "Independent, informational-only community page.",
    isPartOf: {
      "@type": "Organization",
      name: "FZ Labs (content only, non-transactional)",
    },
  };

  return (
    <>
      {/* JSON-LD Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      {/* Community Banner - Always visible */}
      <CommunityBanner locale={locale as "ar" | "en"} />

      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {locale === "ar" ? "مجتمع FZ Token" : "FZ Token Community"}
            </h1>
            <p className="text-xl text-slate-300">
              {locale === "ar"
                ? "صفحة مجتمعية مستقلة - للمعلومات فقط"
                : "Independent Community Page - Informational Only"}
            </p>
          </div>

          {/* Disclaimer Block */}
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-yellow-400 mb-2">
              ⚠️{" "}
              {locale === "ar"
                ? "إخلاء المسؤولية القانوني"
                : "Legal Disclaimer"}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {locale === "ar"
                ? "هذه الصفحة للمعلومات فقط ولا تشكل نصيحة استثمارية أو عرضًا للشراء/البيع. لا ننصح بأي معاملات. الاستثمار في العملات المشفرة محفوف بالمخاطر."
                : "This page is informational only and does not constitute investment advice or an offer to buy/sell. We do not recommend any transactions. Cryptocurrency investments are highly risky."}
            </p>
            <p className="text-xs text-slate-400">
              {locale === "ar"
                ? "لا روابط شراء/بيع. شفافية معلوماتية فقط."
                : "No purchase/sale links. Informational transparency only."}
            </p>
          </div>

          {/* Contract Block */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              {locale === "ar" ? "عقد التوكن" : "Token Contract"}
            </h2>
            <div className="bg-slate-900 rounded p-4 font-mono text-sm break-all text-slate-300">
              {process.env.NEXT_PUBLIC_FZ_TOKEN_CONTRACT ||
                "So1aNa...ContractAddress"}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {locale === "ar"
                ? "عنوان العقد على Solana - تحقق دائماً من المصادر الرسمية"
                : "Contract address on Solana - always verify from official sources"}
            </p>
          </div>

          {/* Info Links (Informational Only) */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              {locale === "ar" ? "روابط معلوماتية" : "Informational Links"}
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              {locale === "ar"
                ? "الروابط التالية للإطلاع فقط - لا نوصي بأي معاملات:"
                : "The following links are for reference only - we do not recommend any transactions:"}
            </p>

            {process.env.NEXT_PUBLIC_DISABLE_SWAP_LINKS !== "true" ? (
              <div className="space-y-3">
                <a
                  href="#"
                  className="block p-3 bg-slate-900 hover:bg-slate-700 rounded transition text-blue-400 hover:text-blue-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {locale === "ar" ? "عرض على Solscan" : "View on Solscan"} →
                </a>
                <a
                  href="#"
                  className="block p-3 bg-slate-900 hover:bg-slate-700 rounded transition text-blue-400 hover:text-blue-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {locale === "ar"
                    ? "عرض على DexScreener"
                    : "View on DexScreener"}{" "}
                  →
                </a>
                <a
                  href="#"
                  className="block p-3 bg-slate-900 hover:bg-slate-700 rounded transition text-blue-400 hover:text-blue-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {locale === "ar"
                    ? "عرض على Raydium"
                    : "View on Raydium"}{" "}
                  →
                </a>
              </div>
            ) : (
              <div className="p-4 bg-slate-900 rounded text-center text-slate-400">
                {locale === "ar"
                  ? "روابط التبادل معطلة - للمعلومات فقط"
                  : "Swap links disabled - informational only"}
              </div>
            )}
          </div>

          {/* Additional Disclaimer */}
          <div className="text-center text-sm text-slate-500 mt-12">
            <p>
              {locale === "ar"
                ? "هذه الصفحة مستقلة وغير تابعة لأي كيان تنظيمي أو معاملاتي."
                : "This page is independent and not affiliated with any regulatory or transactional entity."}
            </p>
            <p className="mt-2">
              {locale === "ar"
                ? "دائماً قم بالبحث الخاص بك (DYOR) قبل أي قرار استثماري."
                : "Always Do Your Own Research (DYOR) before any investment decision."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
