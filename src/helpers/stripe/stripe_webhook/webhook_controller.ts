import { Request, Response } from "express";
import stripe from "../stripe";
import config from "../../../config";
import { processCheckoutSessionCompleted } from "./webhook_services";
import { markWebhookEvent } from "./database_update";

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret not configured");
    return res.status(500).send("Webhook secret not configured");
  }

  let event: any;
  try {
    // req.body must be raw body buffer
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig ?? "",
      webhookSecret,
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // handle the event
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await processCheckoutSessionCompleted(session);
      await markWebhookEvent(event.type, "SUCCESS", event);
    } else {
      // other events can be recorded for future
      await markWebhookEvent(event.type, "PENDING", event);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Failed to process webhook event:", err);
    await markWebhookEvent(event.type || "unknown", "FAILED", {
      error: err.message || err,
    });
    res.status(500).send("Webhook processing failed");
  }
};

export default { handleStripeWebhook };
