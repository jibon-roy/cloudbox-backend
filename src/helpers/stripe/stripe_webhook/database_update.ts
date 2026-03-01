import { prisma } from "../../../lib/prisma";

export const markWebhookEvent = async (
  eventType: string,
  status: "PENDING" | "SUCCESS" | "FAILED",
  payload?: any,
) => {
  try {
    // ensure a Webhook record exists for 'stripe'
    let webhook = await prisma.webhook.findFirst({ where: { url: "stripe" } });
    if (!webhook) {
      webhook = await prisma.webhook.create({
        data: { url: "stripe", secret: null },
      });
    }

    await prisma.webhookEvent.create({
      data: {
        webhookId: webhook.id,
        event_type: eventType,
        payload: payload || {},
        status: status as any,
      },
    });
  } catch (err) {
    console.error("Failed to record webhook event", err);
  }
};

export default { markWebhookEvent };
