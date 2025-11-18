import Link from 'next/link';

async function getAdmins() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/admin/admins`, { 
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error('Failed to load admins');
  }
  
  return res.json();
}

export default async function AdminPage() {
  let admins: Array<{ uid: string; email?: string; roles?: string[] }> = [];
  
  try {
    const data = await getAdmins();
    admins = data.admins ?? [];
  } catch (error) {
    console.error('Error loading admins:', error);
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Control</h1>
        <Link href="/" className="underline hover:no-underline">
          Back
        </Link>
      </header>

      <section className="rounded-2xl p-4 border border-gray-200 bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-3">Admins</h2>
        <div className="grid gap-3">
          {admins.map((a) => (
            <div 
              key={a.uid} 
              className="rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
            >
              <div className="font-mono text-sm text-gray-900">{a.uid}</div>
              <div className="text-sm text-gray-600 mt-1">{a.email ?? '—'}</div>
              <div className="text-xs text-gray-500 mt-1">
                roles: {a.roles?.join(', ') || '—'}
              </div>
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-gray-500 text-sm">No admins yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

