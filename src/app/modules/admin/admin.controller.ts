import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { prisma } from '../../../lib/prisma';

const getStartDateForPeriod = (period: 'weekly' | 'monthly' | 'yearly', from?: string) => {
  if (from) return new Date(from);
  const now = new Date();
  switch (period) {
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'yearly':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
};

// Returns aggregated upload stats per user in the given period
const userTrafficStats = catchAsync(async (req: Request, res: Response) => {
  const period = (req.params.period as 'weekly' | 'monthly' | 'yearly') || 'weekly';
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const startDate = getStartDateForPeriod(period, from);
  const endDate = to ? new Date(to) : new Date();

  // group by userId, count files and sum size_bytes
  const rows: any = await prisma.file.groupBy({
    by: ['userId'],
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
    totalBytes: r._sum && r._sum.size_bytes ? BigInt(r._sum.size_bytes as any).toString() : '0',
  }));

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: `User traffic stats (${period}) fetched`,
    data: result,
  });
});

// User traffic: registered user count by period (weekly, monthly, yearly) for recharts
const userTrafficByPeriod = catchAsync(async (req: Request, res: Response) => {
  const trafficData: Record<string, any> = {};

  // Weekly: daily breakdown (7 days)
  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.user.count({
      where: {
        created_at: { gte: dayStart, lte: dayEnd },
      },
    });

    weeklyData.push({
      date: dayStart.toISOString().split('T')[0],
      registeredUsers: count,
    });
  }
  trafficData.weekly = weeklyData;

  // Monthly: weekly breakdown (30 days)
  const monthlyData = [];
  for (let i = 4; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const count = await prisma.user.count({
      where: {
        created_at: { gte: weekStart, lte: weekEnd },
      },
    });

    monthlyData.push({
      week: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
      registeredUsers: count,
    });
  }
  trafficData.monthly = monthlyData;

  // Yearly: monthly breakdown (12 months)
  const yearlyData = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);
    monthEnd.setHours(23, 59, 59, 999);

    const count = await prisma.user.count({
      where: {
        created_at: { gte: monthStart, lte: monthEnd },
      },
    });

    yearlyData.push({
      month: monthStart.toISOString().substring(0, 7),
      registeredUsers: count,
    });
  }
  trafficData.yearly = yearlyData;

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User traffic data by period fetched',
    data: trafficData,
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
  const billingWhere: any = { status: 'SUCCESS' };
  if (from || to) billingWhere.paid_at = whereDateRange;

  const sumRes: any = await prisma.billingTransaction.aggregate({
    _sum: { amount: true },
    where: billingWhere,
  });
  const totalIncome = sumRes && sumRes._sum && sumRes._sum.amount ? Number(sumRes._sum.amount) : 0;

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Admin summary fetched',
    data: {
      totalUsers,
      totalTransactions,
      totalSubscribers,
      totalIncome,
    },
  });
});

// Contact form submission
const submitContactForm = catchAsync(async (req: Request, res: Response) => {
  const { fullName, workEmail, company, phone, message } = req.body;

  if (!fullName || !workEmail || !message) {
    sendResponse(res, {
      success: false,
      statusCode: httpStatus.BAD_REQUEST,
      message: 'Full name, work email, and message are required',
      data: null,
    });
    return;
  }

  // Send email to admin
  const emailSender = (await import('../../../helpers/email_sender/emailSender')).default;
  const config = (await import('../../../config')).default;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Contact Form Submission</h2>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
        <p><strong>Full Name:</strong> ${fullName}</p>
        <p><strong>Work Email:</strong> ${workEmail}</p>
        <p><strong>Company:</strong> ${company || 'Not provided'}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <hr style="border: 1px solid #ddd; margin: 20px 0;">
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">This email was sent from CloudBox contact form.</p>
    </div>
  `;

  await emailSender(`New Contact Form: ${fullName}`, config.adminEmail, emailHtml);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Contact form submitted successfully. We will get back to you within 24 hours.',
    data: { submitted: true },
  });
});

export const AdminController = {
  userTrafficStats,
  userTrafficByPeriod,
  adminSummary,
  submitContactForm,
};

export default AdminController;
