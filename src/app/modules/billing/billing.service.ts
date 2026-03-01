import { prisma } from "../../../lib/prisma";
import ApiError from "../../../errors/apiError";
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";

export const BillingService = {
  getAllBillings: async (filters: any) => {
    const { from, to, status, page = 1, limit = 20 } = filters || {};
    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {} as any;
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      prisma.billingTransaction.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.billingTransaction.count({ where }),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  },

  getUserBillings: async (userId: string, filters: any) => {
    const { from, to, page = 1, limit = 20 } = filters || {};
    const where: any = { userId };
    if (from || to) {
      where.created_at = {} as any;
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      prisma.billingTransaction.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.billingTransaction.count({ where }),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  },

  changeBillingStatus: async (id: string, status: string) => {
    const allowed = ["PENDING", "SUCCESS", "FAILED"];
    if (!allowed.includes(status))
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid billing status");

    const billing = await prisma.billingTransaction.update({
      where: { id },
      data: { status: status as any },
    });

    // If billing marked SUCCESS and no subscription linked, create subscription
    // If billing has subscriptionId and status changed to SUCCESS, ensure subscription is active
    if (status === "SUCCESS" && billing.subscriptionId) {
      try {
        await prisma.userSubscription.update({
          where: { id: billing.subscriptionId },
          data: { is_active: true },
        });
      } catch (err) {
        // ignore
      }
    }
    return { billing };
  },

  confirmPaymentByReference: async (reference: string) => {
    const billing = await prisma.billingTransaction.findFirst({
      where: { reference },
    });
    if (!billing) throw new ApiError(httpStatus.NOT_FOUND, "Billing not found");

    if (billing.status === "SUCCESS") return { billing };

    const updated = await prisma.billingTransaction.update({
      where: { id: billing.id },
      data: { status: "SUCCESS", paid_at: new Date() },
    });

    // If billing is linked to a subscription record, activate it. If not, we cannot create a subscription here because packageId is unknown.
    if (updated.subscriptionId) {
      try {
        await prisma.userSubscription.update({
          where: { id: updated.subscriptionId },
          data: { is_active: true },
        });
      } catch (err) {
        // ignore
      }
    }

    return { billing: updated };
  },

  getAllActiveSubscriptions: async (filters: any) => {
    const { page = 1, limit = 50 } = filters || {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { is_active: true },
        include: {
          user: { select: { id: true, email: true, name: true } },
          package: true,
        },
        orderBy: { created_at: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.userSubscription.count({ where: { is_active: true } }),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  },

  changeSubscriptionStatus: async (id: string, isActive: boolean) => {
    const data: any = { is_active: isActive };
    if (!isActive) data.ended_at = new Date();
    const sub = await prisma.userSubscription.update({ where: { id }, data });
    return sub;
  },
};

export default BillingService;
