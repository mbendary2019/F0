import { useEffect, useState } from "react";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { auth } from "@/lib/firebaseClient";

/**
 * Entitlements data structure
 */
export interface Entitlements {
  active: boolean;
  tier: string;
  provider?: string;
  periodEnd?: number;
  customerId?: string;
  subscriptionId?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Hook to manage user subscription entitlements
 *
 * @returns Entitlements object or null if not loaded/no subscription
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const entitlements = useEntitlements();
 *
 *   if (!entitlements) return <div>Loading...</div>;
 *
 *   return (
 *     <button disabled={!entitlements.active}>
 *       Pro Feature
 *     </button>
 *   );
 * }
 * ```
 */
export function useEntitlements(): Entitlements | null {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setEntitlements({ active: false, tier: "free" });
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data();

        if (data?.entitlements) {
          // Convert Firestore Timestamp to milliseconds
          const periodEnd = data.entitlements.periodEnd?.toMillis?.() ||
                           data.entitlements.periodEnd;

          setEntitlements({
            ...data.entitlements,
            periodEnd,
          } as Entitlements);
        } else {
          // No entitlements found, set free tier
          setEntitlements({ active: false, tier: "free" });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching entitlements:", error);
        setEntitlements({ active: false, tier: "free" });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  return loading ? null : entitlements;
}

/**
 * Helper hook to check if user has active subscription
 */
export function useHasActiveSubscription(): boolean {
  const entitlements = useEntitlements();
  return entitlements?.active ?? false;
}

/**
 * Helper hook to get subscription tier
 */
export function useSubscriptionTier(): string {
  const entitlements = useEntitlements();
  return entitlements?.tier ?? "free";
}

/**
 * Helper hook to check if subscription is pro tier
 */
export function useIsProUser(): boolean {
  const entitlements = useEntitlements();
  return entitlements?.active === true && entitlements?.tier === "pro";
}
