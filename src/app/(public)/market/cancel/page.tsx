export default function Cancel() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border p-6 text-center space-y-4">
        <div className="text-4xl">❌</div>
        <h1 className="text-2xl font-semibold">Payment Canceled</h1>
        <p className="opacity-70">Your payment was canceled. No charges were made.</p>
        <a href="/market" className="inline-block rounded-md border px-4 py-2 hover:bg-gray-50">
          Back to Marketplace
        </a>
      </div>
    </div>
  );
}
