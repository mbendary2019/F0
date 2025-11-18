// Shared dynamic route configuration
// Use this for API routes that need runtime execution (Firestore, auth, etc)
export const dynamic = 'force-dynamic' as const;
export const revalidate = 0 as const;
export const runtime = 'nodejs' as const;
