import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * Advanced analytics daily aggregation
 * Computes 24h/7d metrics, top products, coupon usage
 */
export const analyticsAdvancedDaily = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const now = Date.now();
  const d1 = now - 24 * 60 * 60 * 1000;
  const d7 = now - 7 * 24 * 60 * 60 * 1000;

  const orders24 = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", d1)
    .get();
  const orders7 = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", d7)
    .get();

  function collect(orders: FirebaseFirestore.QuerySnapshot) {
    let ordersCount = 0,
      rev = 0,
      plat = 0,
      creators = 0;
    const byProduct = new Map<
      string,
      { productId: string; title?: string; orders: number; revenueUsd: number }
    >();
    const byCoupon = new Map<
      string,
      { code: string; orders: number; revenueUsd: number }
    >();

    for (const d of orders.docs) {
      const o = d.data() as any;
      ordersCount++;
      const amount = Number(o.amountUsd || 0);
      const platformFee = Number(o.platformFeeUsd || 0);
      const toCreator = Number(o.amountToCreatorUsd || amount - platformFee);
      rev += amount;
      plat += platformFee;
      creators += toCreator;

      const pid = o.productId || o.product?.id || null;
      if (pid) {
        const cur = byProduct.get(pid) || {
          productId: pid,
          title: o.product?.title,
          orders: 0,
          revenueUsd: 0,
        };
        cur.orders += 1;
        cur.revenueUsd += amount;
        byProduct.set(pid, cur);
      }

      const code = (o.couponCode || o.metadata?.couponCode || "").toUpperCase();
      if (code) {
        const cur = byCoupon.get(code) || { code, orders: 0, revenueUsd: 0 };
        cur.orders += 1;
        cur.revenueUsd += amount;
        byCoupon.set(code, cur);
      }
    }

    const topProducts = Array.from(byProduct.values())
      .sort((a, b) => b.revenueUsd - a.revenueUsd)
      .slice(0, 10);
    const couponUsage = Array.from(byCoupon.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    return {
      summary: {
        orders: ordersCount,
        revenueUsd: Math.round(rev * 100) / 100,
        platformUsd: Math.round(plat * 100) / 100,
        creatorsUsd: Math.round(creators * 100) / 100,
      },
      topProducts,
      couponUsage,
    };
  }

  const s24 = collect(orders24);
  const s7 = collect(orders7);

  await db
    .collection("analytics")
    .doc("advanced_daily")
    .set(
      {
        ts: now,
        last24h: s24.summary,
        last7d: s7.summary,
        topProducts24h: s24.topProducts,
        topProducts7d: s7.topProducts,
        couponUsage24h: s24.couponUsage,
        couponUsage7d: s7.couponUsage,
      },
      { merge: true }
    );

  console.log(
    `📊 Advanced analytics computed: 24h=${s24.summary.orders} orders, 7d=${s7.summary.orders} orders`
  );
});
