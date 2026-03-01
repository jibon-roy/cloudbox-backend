import { prisma } from "../../../lib/prisma";
import stripe from "../../../helpers/stripe/stripe";
import config from "../../../config";
import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import { redis } from "../../../lib/redisConnection";

export const SubscriptionService = {
  createPackage: async (data: any) => {
    const createData: any = {
      name: data.name,
      is_active: data.is_active ?? true,
    };
    if (data.price !== undefined && data.price !== null)
      createData.price = Number(data.price);
    if (data.max_folders !== undefined)
      createData.max_folders = data.max_folders;
    if (data.max_nesting_level !== undefined)
      createData.max_nesting_level = data.max_nesting_level;
    if (data.total_file_limit !== undefined)
      createData.total_file_limit = data.total_file_limit;
    if (data.files_per_folder !== undefined)
      createData.files_per_folder = data.files_per_folder;
    if (data.max_file_size_mb !== undefined)
      createData.max_file_size_mb = data.max_file_size_mb;
    if (data.max_storage_mb !== undefined)
      createData.max_storage_mb = data.max_storage_mb;
    if (data.trial_days !== undefined) createData.trial_days = data.trial_days;

    const pkg = await prisma.subscriptionPackage.create({ data: createData });
    return pkg;
  },

  getAllPackages: async () => {
    const pkgs = await prisma.subscriptionPackage.findMany({
      where: { deleted_at: null, is_active: true },
    });
    return pkgs;
  },

  getAllPackagesAdmin: async () => {
    const pkgs = await prisma.subscriptionPackage.findMany({
      orderBy: { created_at: "desc" },
    });
    return pkgs;
  },

  getPackageById: async (id: string) => {
    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id } });
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, "Package not found");
    return pkg;
  },

  updatePackage: async (id: string, data: any) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined && data.price !== null)
      updateData.price = Number(data.price);
    if (data.max_folders !== undefined)
      updateData.max_folders = data.max_folders;
    if (data.max_nesting_level !== undefined)
      updateData.max_nesting_level = data.max_nesting_level;
    if (data.total_file_limit !== undefined)
      updateData.total_file_limit = data.total_file_limit;
    if (data.files_per_folder !== undefined)
      updateData.files_per_folder = data.files_per_folder;
    if (data.max_file_size_mb !== undefined)
      updateData.max_file_size_mb = data.max_file_size_mb;
    if (data.max_storage_mb !== undefined)
      updateData.max_storage_mb = data.max_storage_mb;
    if (data.trial_days !== undefined) updateData.trial_days = data.trial_days;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const pkg = await prisma.subscriptionPackage.update({
      where: { id },
      data: updateData,
    });
    return pkg;
  },

  deletePackage: async (id: string) => {
    const pkg = await prisma.subscriptionPackage.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    return pkg;
  },

  buySubscription: async (
    userId: string,
    packageId: string,
    userEmail: string,
    months: number,
  ) => {
    // try cache first to reduce DB latency
    const cacheKey = `subscription:package:${packageId}`;
    let pkg: any = null;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) pkg = JSON.parse(cached);
    } catch (err) {
      // ignore cache errors
    }

    if (!pkg) {
      pkg = await prisma.subscriptionPackage.findUnique({
        where: { id: packageId },
      });
      if (pkg) {
        try {
          // cache for 5 minutes
          await redis.set(cacheKey, JSON.stringify(pkg), "EX", 300);
        } catch (err) {
          // ignore cache set errors
        }
      }
    }

    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, "Package not found");

    // If price is null or zero — treat as free plan: create subscription immediately
    const pkgPrice = pkg.price === null ? 0 : Number(pkg.price);
    if (pkgPrice <= 0) {
      // Free plan: create subscription immediately with no end date (unlimited)
      const startedAt = new Date();

      const [userSub, billing] = await prisma.$transaction([
        prisma.userSubscription.create({
          data: {
            userId,
            packageId,
            started_at: startedAt,
            ended_at: null,
            is_active: true,
          },
        }),
        prisma.billingTransaction.create({
          data: {
            userId,
            amount: 0,
            currency: "usd",
            status: "SUCCESS",
            provider: "free",
            reference: `free_tx_${userId}_${Date.now()}`,
            paid_at: new Date(),
          },
        }),
      ]);

      // link billing to subscription (attempt, but don't fail purchase if linking errors)
      try {
        await prisma.billingTransaction.update({
          where: { id: billing.id },
          data: { subscriptionId: userSub.id },
        });
      } catch (err) {
        // ignore
      }

      return { subscription: userSub, is_free: true };
    }

    const totalAmount = pkgPrice * months;
    const amountInCents = Math.round(totalAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pkg.name,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      success_url: `${config.frontend_url}/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontend_url}/payments/stripe/cancel`,
      metadata: {
        userId,
        packageId,
        months: String(months),
      },
    });

    return { url: session.url, id: session.id };
  },

  updateUserSubscription: async (
    userId: string,
    packageId: string,
    userEmail: string,
    months: number,
  ) => {
    // try cache first
    const cacheKey = `subscription:package:${packageId}`;
    let pkg: any = null;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) pkg = JSON.parse(cached);
    } catch (err) {
      // ignore cache errors
    }
    if (!pkg) {
      pkg = await prisma.subscriptionPackage.findUnique({
        where: { id: packageId },
      });
      if (pkg) {
        try {
          await redis.set(cacheKey, JSON.stringify(pkg), "EX", 300);
        } catch (err) {
          // ignore cache set errors
        }
      }
    }
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, "Package not found");
    const active = await prisma.userSubscription.findFirst({
      where: { userId, is_active: true },
    });
    if (!active)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No active subscription to update",
      );
    // Allow zero-priced packages for immediate update (no Stripe)
    const pkgPrice = pkg.price === null ? 0 : Number(pkg.price);
    if (pkgPrice <= 0) {
      // immediately deactivate current active subscription and create new unlimited subscription
      const startedAt = new Date();

      const [newSub, billing] = await prisma.$transaction([
        prisma.userSubscription.update({
          where: { id: active.id },
          data: { is_active: false, ended_at: new Date() },
        }),
        prisma.userSubscription.create({
          data: {
            userId,
            packageId,
            started_at: startedAt,
            ended_at: null,
            is_active: true,
          },
        }),
        prisma.billingTransaction.create({
          data: {
            userId,
            amount: 0,
            currency: "usd",
            status: "SUCCESS",
            provider: "free",
            reference: `free_tx_update_${userId}_${Date.now()}`,
            paid_at: new Date(),
          },
        }),
      ]);

      // link billing to the newly created subscription (best-effort)
      try {
        await prisma.billingTransaction.update({
          where: { id: billing.id },
          data: { subscriptionId: newSub.id },
        });
      } catch (err) {
        // ignore
      }

      return { subscription: newSub, is_free: true };
    }

    const totalAmount = pkgPrice * months;
    const amountInCents = Math.round(totalAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Update to ${pkg.name}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      success_url: `${config.frontend_url}/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontend_url}/payments/stripe/cancel`,
      metadata: {
        userId,
        packageId,
        action: "update",
        subscriptionId: active.id,
        months: String(months),
      },
    });

    return { url: session.url, id: session.id };
  },

  cancelUserSubscription: async (userId: string) => {
    const active = await prisma.userSubscription.findFirst({
      where: { userId, is_active: true },
    });
    if (!active)
      throw new ApiError(httpStatus.NOT_FOUND, "No active subscription found");

    const updated = await prisma.userSubscription.update({
      where: { id: active.id },
      data: { is_active: false, ended_at: new Date() },
    });
    return updated;
  },

  getUserActiveSubscription: async (userId: string) => {
    const active = await prisma.userSubscription.findFirst({
      where: { userId, is_active: true },
      include: { package: true },
    });
    return active;
  },
};

export default SubscriptionService;
