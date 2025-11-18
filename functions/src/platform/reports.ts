import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as PDFKit from "pdfkit";

function monthRange(yyyyMM: string) {
  const [Y, M] = yyyyMM.split("-").map(Number);
  const start = Date.UTC(Y, M - 1, 1);
  const end = Date.UTC(M === 12 ? Y + 1 : Y, M === 12 ? 0 : M, 1);
  return { start, end };
}

/**
 * Generate platform monthly report PDF
 * Aggregates: orders, revenue, platform fees, creator payments, refunds, disputes
 * Includes top products and coupons
 * Callable by admin only
 */
export const generatePlatformMonthlyReport = onCall(
  async (request) => {
    const t = (request.auth?.token || {}) as any;
    if (!request.auth || !t.admin) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    // Default to current month if not specified
    const month =
      request.data?.month ||
      (() => {
        const d = new Date();
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
      })();

    const db = admin.firestore();
    const { start, end } = monthRange(month);

    // Fetch data for the month
    const paid = await db
      .collection("orders")
      .where("status", "==", "paid")
      .where("paidAt", ">=", start)
      .where("paidAt", "<", end)
      .get();

    const refunded = await db
      .collection("orders")
      .where("status", "==", "refunded")
      .where("refundedAt", ">=", start)
      .where("refundedAt", "<", end)
      .get();

    const disputes = await db
      .collection("disputes")
      .where("createdAt", ">=", start)
      .where("createdAt", "<", end)
      .get();

    // Aggregate metrics
    let orders = 0,
      gross = 0,
      platform = 0,
      creators = 0;
    const byProduct = new Map<
      string,
      { title?: string; revenue: number; count: number }
    >();
    const byCoupon = new Map<string, { orders: number; revenue: number }>();

    for (const d of paid.docs) {
      const o = d.data() as any;
      orders++;
      const g = Number(o.amountUsd || 0);
      const pf = Number(o.platformFeeUsd || 0);
      const cr = Number(o.amountToCreatorUsd || g - pf);
      gross += g;
      platform += pf;
      creators += cr;

      // By product
      const pid = o.productId || o.product?.id || "unknown";
      const title = o.product?.title;
      const c1 = byProduct.get(pid) || { title, revenue: 0, count: 0 };
      c1.revenue += g;
      c1.count += 1;
      byProduct.set(pid, c1);

      // By coupon
      const code = (o.couponCode || "").toString().toUpperCase();
      if (code) {
        const c2 = byCoupon.get(code) || { orders: 0, revenue: 0 };
        c2.orders += 1;
        c2.revenue += g;
        byCoupon.set(code, c2);
      }
    }

    const refundsTotal = refunded.docs.reduce(
      (a, d) => a + Number((d.data() as any)?.refund?.amountUsd || 0),
      0
    );

    const topProducts = Array.from(byProduct.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([id, v]) => ({
        id,
        title: v.title,
        orders: v.count,
        revenueUsd: Math.round(v.revenue * 100) / 100,
      }));

    const topCoupons = Array.from(byCoupon.entries())
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 10)
      .map(([code, v]) => ({
        code,
        orders: v.orders,
        revenueUsd: Math.round(v.revenue * 100) / 100,
      }));

    // Generate PDF
    const doc = new (PDFKit as any)({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));

    doc.fontSize(18).text(`Platform Report — ${month}`, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Orders: ${orders}`);
    doc.text(
      `Gross: $${gross.toFixed(2)}  |  Platform: $${platform.toFixed(2)}  |  Creators: $${creators.toFixed(2)}`
    );
    doc.text(`Refunds: $${refundsTotal.toFixed(2)}  |  Disputes: ${disputes.size}`);
    doc.moveDown().text("Top Products:");
    topProducts.forEach((p, i) =>
      doc.text(
        `${i + 1}. ${p.title || p.id} — $${p.revenueUsd.toFixed(2)} (${p.orders} orders)`
      )
    );
    doc.moveDown().text("Top Coupons:");
    topCoupons.forEach((c, i) =>
      doc.text(`${i + 1}. ${c.code} — $${c.revenueUsd.toFixed(2)} (${c.orders} orders)`)
    );

    doc.end();
    await new Promise((r) => doc.on("end", r));
    const pdf = Buffer.concat(chunks);

    // Save to Storage
    const storage = admin.storage().bucket();
    const path = `platform_reports/${month}.pdf`;
    await storage.file(path).save(pdf, { contentType: "application/pdf", resumable: false });

    // Store metadata
    await db
      .collection("platform_reports")
      .doc("files")
      .collection("months")
      .doc(month)
      .set(
        {
          month,
          path,
          size: pdf.length,
          createdAt: Date.now(),
          orders,
          gross: Math.round(gross * 100) / 100,
          platform: Math.round(platform * 100) / 100,
          creators: Math.round(creators * 100) / 100,
          refundsTotal: Math.round(refundsTotal * 100) / 100,
          disputes: disputes.size,
        },
        { merge: true }
      );

    // Generate signed URL (7 days)
    const [url] = await storage.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return { month, url };
  }
);
