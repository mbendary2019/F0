// Stripe Checkout Session Creator
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const origin = req.headers.get("origin") || "http://localhost:3000";
    
    const {
      priceId = process.env.STRIPE_PRICE_MONTHLY,
      mode = "subscription",
      successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl = `${origin}/pricing`,
      metadata = {},
    } = body;

    console.log("Creating checkout session:", {
      priceId,
      mode,
      successUrl,
      cancelUrl,
      metadata,
    });

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: mode as "subscription" | "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...metadata,
        // Add timestamp for tracking
        created_at: new Date().toISOString(),
      },
      // Customer details
      customer_email: metadata.email || undefined,
      // Subscription specific settings
      ...(mode === "subscription" && {
        subscription_data: {
          metadata,
        },
      }),
    });

    console.log("Checkout session created:", session.id);

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
      message: "Checkout session created successfully",
    });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve session details
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "Missing session_id parameter" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email,
        amount_total: session.amount_total,
        metadata: session.metadata,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving session:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
