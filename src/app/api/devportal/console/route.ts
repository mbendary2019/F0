export async function POST(req: Request) {
  const { endpoint, method = "GET", body, headers } = await req.json();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
  const url = `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(headers || {}) },
    body: ["POST","PUT","PATCH"].includes(method) ? JSON.stringify(body ?? {}) : undefined,
  });

  const text = await r.text();
  return new Response(text, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "text/plain" }});
}
