"use client";
import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";

export default function BundleDetail({ params }: { params: { slug: string } }) {
  const [bundle, setBundle] = useState<any>(null);
  const [buying, setBuying] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/market/bundle/${params.slug}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.error) setBundle(j);
    })();
  }, [params.slug]);

  const buy = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      router.push("/login");
      return;
    }

    setBuying(true);
    try {
      const fn = httpsCallable(getFunctions(), "createCheckoutSession");
      const res: any = await fn({ bundleId: bundle.id });
      const url = res?.data?.url;
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message || "Failed to create checkout");
    } finally {
      setBuying(false);
    }
  };

  if (!bundle) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{bundle.title}</h1>
      {bundle.imageUrl && (
        <img src={bundle.imageUrl} alt="" className="w-full rounded-xl border" />
      )}
      <p className="opacity-80">{bundle.description}</p>
      <div className="text-sm opacity-70">Includes {bundle.productIds?.length || 0} products.</div>
      <div className="text-xs opacity-70">Final price & taxes at checkout.</div>
      <button
        onClick={buy}
        disabled={buying}
        className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
      >
        {buying ? "Redirecting…" : "Buy now"}
      </button>
    </div>
  );
}
