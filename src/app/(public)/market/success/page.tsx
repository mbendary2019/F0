export default function Success() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border p-6 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h1 className="text-2xl font-semibold">Payment Successful!</h1>
        <p className="opacity-70">Your license is being granted. Check your licenses page in a moment.</p>
        <a href="/account/licenses" className="inline-block rounded-md bg-black px-4 py-2 text-white hover:opacity-90">
          View My Licenses
        </a>
      </div>
    </div>
  );
}
