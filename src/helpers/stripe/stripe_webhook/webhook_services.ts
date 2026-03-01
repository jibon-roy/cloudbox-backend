import { prisma } from "../../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";

export const processCheckoutSessionCompleted = async (session: any) => {
  try {
    const metadata = session.metadata || {};
    const userId = metadata.userId as string | undefined;
    const packageId = metadata.packageId as string | undefined;
    const action = metadata.action as string | undefined; // 'update' for upgrades
    const subscriptionId = metadata.subscriptionId as string | undefined;

    if (!userId || !packageId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Missing userId or packageId in session metadata",
      );
    }

    // Create BillingTransaction
    const amount = session.amount_total
      ? Number(session.amount_total) / 100
      : null;
    const currency = session.currency || "usd";
    const provider = "stripe";
    const reference = session.id;

    const billing = await prisma.billingTransaction.create({
      data: {
        userId,
        amount: amount ?? 0,
        currency,
        status: "SUCCESS",
        provider,
        reference,
        paid_at: new Date(),
      },
    });

    if (action === "update" && subscriptionId) {
      // deactivate old subscription
      await prisma.userSubscription.updateMany({
        where: { id: subscriptionId, is_active: true },
        data: { is_active: false, ended_at: new Date() },
      });

      // create new subscription record
      const newSub = await prisma.userSubscription.create({
        data: {
          userId,
          packageId,
          started_at: new Date(),
          is_active: true,
        },
      });

      // Link billing to new subscription
      await prisma.billingTransaction.update({
        where: { id: billing.id },
        data: { subscriptionId: newSub.id },
      });
      return { billing, subscription: newSub };
    }

    // Default: treat as a purchase
    const userSub = await prisma.userSubscription.create({
      data: {
        userId,
        packageId,
        started_at: new Date(),
        is_active: true,
      },
    });

    await prisma.billingTransaction.update({
      where: { id: billing.id },
      data: { subscriptionId: userSub.id },
    });

    return { billing, subscription: userSub };
  } catch (error) {
    throw error;
  }
};

export default { processCheckoutSessionCompleted };
