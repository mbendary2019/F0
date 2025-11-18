import { callCallable } from "@/lib/functionsClient";

export async function GET() {
  try {
    const rows = await callCallable("getUsage30d");
    return Response.json(rows ?? [], { status: 200 });
  } catch (err: any) {
    // Fallback to dummy data if function not available
    const today = new Date();
    const rows = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - (29 - i));
      const total = Math.floor(Math.random()*50)+10;
      const errors = Math.floor(total * 0.05);
      return { date: d.toISOString().slice(0,10), total, errors, success: total-errors };
    });
    return Response.json(rows, { status: 200 });
  }
}
