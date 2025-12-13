"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { useCurrency } from "../_components/CurrencySwitcher";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/**
 * Get or create session ID in localStorage
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("_fzSessionId");
  if (!sid) {
    sid = uuidv4();
    localStorage.setItem("_fzSessionId", sid);
  }
  return sid;
}

/**
 * Parse UTM parameters from URL
 */
function parseUTM(searchParams: URLSearchParams): any {
  const source = searchParams.get("utm_source");
  const medium = searchParams.get("utm_medium");
  const campaign = searchParams.get("utm_campaign");
  if (!source && !medium && !campaign) return null;
  return { source, medium, campaign };
}

/**
 * Track event to server
 */
async function trackEvent(kind: string, productId: string | null, searchParams: URLSearchParams) {
  try {
    await fetch("/api/events/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        productId,
        sessionId: getSessionId(),
        utm: parseUTM(searchParams),
      }),
    });
  } catch (err) {
    console.error("Failed to track event:", err);
  }
}

function ProductPageContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [p, setP] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [taxId, setTaxId] = useState("");
  const [taxIdType, setTaxIdType] = useState("eu_vat");
  const [convertedPrice, setConvertedPrice] = useState<number | null>(null);
  const { code: currency, rate } = useCurrency();

  useEffect(()=> onAuthStateChanged(getAuth(), u=>setUser(u)), []);
  useEffect(()=>{
    fetch(`/api/market/product/${params.slug}`, { cache:"no-store" })
      .then(r=> r.ok ? r.json() : null).then(async (d) => {
        setP(d);
        // Track view_product event when product loads
        if (d?.id) {
          trackEvent("view_product", d.id, searchParams);
        }
        // Convert price if not USD
        if (d?.priceUsd && currency !== "USD") {
          try {
            const res = await fetch("/api/market/pricing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ baseUsd: d.priceUsd, currency })
            });
            const data = await res.json();
            setConvertedPrice(data.converted || d.priceUsd);
          } catch (err) {
            setConvertedPrice(d.priceUsd);
          }
        } else {
          setConvertedPrice(d?.priceUsd || null);
        }
      });
    fetch(`/api/market/product/${params.slug}/reviews`, { cache:"no-store" })
      .then(r=> r.ok ? r.json() : null).then(j=>setReviews(j?.reviews||[]));
  }, [params.slug, searchParams, currency]);

  const buy = async () => {
    if (!user) { router.push("/login"); return; }
    setBusy(true);
    try {
      // Track start_checkout event before initiating checkout
      await trackEvent("start_checkout", p.id, searchParams);

      const fn = httpsCallable(getFunctions(), "createCheckoutSession");
      const res: any = await fn({
        productId: p.id,
        couponCode: couponCode || undefined,
        currency: currency || "USD",
        customerTaxId: taxId || undefined
      });
      // Redirect to checkout URL
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } finally { setBusy(false); }
  };

  const submitReview = async () => {
    if (!user) { router.push("/login"); return; }
    setSubmitting(true);
    try {
      const fn = httpsCallable(getFunctions(), "submitReview");
      const res: any = await fn({ productId: p.id, rating, text });
      const reviewId = res?.data?.id as string | undefined;

      // Upload images if present (max 3)
      if (reviewId && files && files.length) {
        const storage = getStorage();
        const userId = getAuth().currentUser?.uid;
        for (let i = 0; i < Math.min(files.length, 3); i++) {
          const f = files.item(i)!;
          const path = `review_media/${userId}/${reviewId}/${Date.now()}_${f.name}`;
          await uploadBytes(ref(storage, path), f, { contentType: f.type });
        }
      }

      alert("Review submitted! It may be pending moderation.");
      setText("");
      setFiles(null);
      // Reload reviews
      const r = await fetch(`/api/market/product/${params.slug}/reviews`, { cache:"no-store" });
      const j = await r.json();
      setReviews(j?.reviews||[]);
    } catch (err: any) {
      alert(err.message || "Failed to submit review");
    } finally { setSubmitting(false); }
  };

  if (!p) return <div className="p-6">Loading…</div>;
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="text-2xl font-semibold">{p.title}</div>
      <div className="opacity-80 text-sm whitespace-pre-wrap">{p.description}</div>
      <div className="text-xl font-bold">
        {currency === 'USD' ? '$' : currency + ' '}{convertedPrice?.toFixed(2) || p.priceUsd}
        <span className="text-sm opacity-60 ml-2">+ tax at checkout</span>
      </div>
      {p.ratingAvg && <div className="text-sm">⭐ {p.ratingAvg} ({p.ratingCount} reviews)</div>}

      {/* Ratings Histogram */}
      {p?.ratingBuckets && (
        <div className="rounded-xl border p-3 text-sm">
          <div className="font-medium mb-2">Ratings breakdown</div>
          {[5, 4, 3, 2, 1].map((stars) => {
            const n = p.ratingBuckets[stars] || 0;
            return (
              <div key={stars} className="flex items-center gap-2">
                <div className="w-10">★{stars}</div>
                <div className="h-2 bg-gray-200 rounded w-full">
                  <div
                    className="h-2 bg-black rounded"
                    style={{ width: `${Math.min(100, (n / (p.ratingCount || 1)) * 100)}%` }}
                  />
                </div>
                <div className="w-10 text-right">{n}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Coupon code (optional)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="px-3 py-2 border rounded"
          />
        </div>

        {/* Tax ID Input (for B2B EU) */}
        <div className="flex gap-2 items-center">
          <select
            value={taxIdType}
            onChange={(e) => setTaxIdType(e.target.value)}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="eu_vat">EU VAT</option>
            <option value="gb_vat">GB VAT</option>
            <option value="au_abn">AU ABN</option>
            <option value="in_gst">IN GST</option>
          </select>
          <input
            type="text"
            placeholder="Tax ID (optional, for B2B)"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className="px-3 py-2 border rounded flex-1"
          />
        </div>

        <button onClick={buy} disabled={busy}
          className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">
          {busy ? "Redirecting…" : "Buy with Stripe"}
        </button>
      </div>

      {/* Reviews Section */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Reviews</h2>

        {/* Submit Review */}
        {user && (
          <div className="mb-6 p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Write a Review</h3>
            <div className="mb-2">
              <label className="block text-sm mb-1">Rating</label>
              <select value={rating} onChange={(e)=>setRating(Number(e.target.value))}
                className="px-3 py-2 border rounded">
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Average</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Terrible</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-sm mb-1">Comment</label>
              <textarea value={text} onChange={(e)=>setText(e.target.value)}
                className="w-full px-3 py-2 border rounded" rows={3}
                placeholder="Share your experience..."/>
            </div>
            <div className="mb-2">
              <label className="block text-sm mb-1">Images (optional, max 3)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <button onClick={submitReview} disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.map(r=>(
            <div key={r.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-medium">{"⭐".repeat(r.rating)}</div>
                <div className="text-sm opacity-70">{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-sm whitespace-pre-wrap">{r.text}</div>
              {Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {r.mediaUrls.map((u: string, i: number) => (
                    <img
                      key={i}
                      src={u}
                      alt=""
                      className="h-24 w-24 object-cover rounded-md border"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {!reviews.length && <div className="opacity-70 text-sm">No reviews yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ProductPageContent />
    </Suspense>
  );
}
