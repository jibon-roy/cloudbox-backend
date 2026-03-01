import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import { prisma } from "../../../lib/prisma";

const getStartDateForPeriod = (
  period: "weekly" | "monthly" | "yearly",
  from?: string,
) => {
  if (from) return new Date(from);
  const now = new Date();
  switch (period) {
    case "weekly":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "yearly":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
};

// Returns aggregated upload stats per user in the given period
const userTrafficStats = catchAsync(async (req: Request, res: Response) => {
  const period =
    (req.params.period as "weekly" | "monthly" | "yearly") || "weekly";
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const startDate = getStartDateForPeriod(period, from);
  const endDate = to ? new Date(to) : new Date();

  // group by userId, count files and sum size_bytes
  const rows: any = await prisma.file.groupBy({
    by: ["userId"],
    _count: { id: true },
    _sum: { size_bytes: true },
    where: {
      is_deleted: false,
      created_at: { gte: startDate, lte: endDate },
    },
  });

  // fetch basic user info for each userId
  const userIds = rows.map((r: any) => r.userId).filter(Boolean);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const userMap: Record<string, any> = {};
  users.forEach((u: any) => (userMap[u.id] = u));

  const result = rows.map((r: any) => ({
    user: userMap[r.userId] || { id: r.userId },
    totalFiles: r._count ? r._count.id : 0,
    totalBytes:
      r._sum && r._sum.size_bytes
        ? BigInt(r._sum.size_bytes as any).toString()
        : "0",
  }));

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: `User traffic stats (${period}) fetched`,
    data: result,
  });
});

// Admin summary: total users, total transactions, total subscribers, total income
const adminSummary = catchAsync(async (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const whereDateRange: any = {};
  if (from) whereDateRange.gte = new Date(from);
  if (to) whereDateRange.lte = new Date(to);

  const totalUsers = await prisma.user.count();
  const totalTransactions = await prisma.billingTransaction.count();
  const totalSubscribers = await prisma.userSubscription.count({
    where: { is_active: true },
  });

  // Sum income from successful billing transactions; optionally use date range on `paid_at` if provided
  const billingWhere: any = { status: "SUCCESS" };
  if (from || to) billingWhere.paid_at = whereDateRange;

  const sumRes: any = await prisma.billingTransaction.aggregate({
    _sum: { amount: true },
    where: billingWhere,
  });
  const totalIncome =
    sumRes && sumRes._sum && sumRes._sum.amount
      ? Number(sumRes._sum.amount)
      : 0;

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Admin summary fetched",
    data: {
      totalUsers,
      totalTransactions,
      totalSubscribers,
      totalIncome,
    },
  });
});

export const AdminController = {
  userTrafficStats,
  adminSummary,
};

export default AdminController;
