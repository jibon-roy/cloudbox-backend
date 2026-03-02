import { prisma } from '../../../lib/prisma';
import stripe from '../../../helpers/stripe/stripe';
import config from '../../../config';
import httpStatus from 'http-status';
import ApiError from '../../../errors/apiError';
import { redis } from '../../../lib/redisConnection';

export const SubscriptionService = {
  createPackage: async (data: any) => {
    const createData: any = {
      name: data.name,
      is_active: data.is_active ?? true,
    };
    if (data.price !== undefined && data.price !== null) createData.price = Number(data.price);
    if (data.max_folders !== undefined) createData.max_folders = data.max_folders;
    if (data.max_nesting_level !== undefined) createData.max_nesting_level = data.max_nesting_level;
    if (data.total_file_limit !== undefined) createData.total_file_limit = data.total_file_limit;
    if (data.files_per_folder !== undefined) createData.files_per_folder = data.files_per_folder;
    if (data.max_file_size_mb !== undefined) createData.max_file_size_mb = data.max_file_size_mb;
    if (data.max_storage_mb !== undefined) createData.max_storage_mb = data.max_storage_mb;
    if (data.trial_days !== undefined) createData.trial_days = data.trial_days;

    const pkg = await prisma.subscriptionPackage.create({ data: createData });

    // if mime types provided on create, persist allowed file types
    if (Array.isArray(data.mime_types) && data.mime_types.length > 0) {
      const rows = data.mime_types.map((m: string) => ({
        subscriptionPackageId: pkg.id,
        mime_type: m as any,
      }));
      try {
        await prisma.packageAllowedFileType.createMany({ data: rows });
      } catch (err) {
        // ignore failures to avoid breaking package creation
      }
    }

    // if file_type_ids provided, convert to mime types via FileType entries and persist
    if (Array.isArray(data.file_type_ids) && data.file_type_ids.length > 0) {
      const fts: any[] = await (prisma as any).fileType.findMany({
        where: { id: { in: data.file_type_ids } },
      });
      if (fts.length > 0) {
        const rows = fts.map((t: any) => ({
          subscriptionPackageId: pkg.id,
          mime_type: t.mime_type,
        }));
        try {
          await prisma.packageAllowedFileType.createMany({ data: rows });
        } catch (err) {
          // ignore
        }
      }
    }

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
      orderBy: { created_at: 'desc' },
    });
    return pkgs;
  },

  getPackageById: async (id: string) => {
    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id } });
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, 'Package not found');
    return pkg;
  },

  updatePackage: async (id: string, data: any) => {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined && data.price !== null) updateData.price = Number(data.price);
    if (data.max_folders !== undefined) updateData.max_folders = data.max_folders;
    if (data.max_nesting_level !== undefined) updateData.max_nesting_level = data.max_nesting_level;
    if (data.total_file_limit !== undefined) updateData.total_file_limit = data.total_file_limit;
    if (data.files_per_folder !== undefined) updateData.files_per_folder = data.files_per_folder;
    if (data.max_file_size_mb !== undefined) updateData.max_file_size_mb = data.max_file_size_mb;
    if (data.max_storage_mb !== undefined) updateData.max_storage_mb = data.max_storage_mb;
    if (data.trial_days !== undefined) updateData.trial_days = data.trial_days;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const pkg = await prisma.subscriptionPackage.update({
      where: { id },
      data: updateData,
    });

    // if mime_types provided, replace allowed file types
    if (Array.isArray(data.mime_types)) {
      await SubscriptionService.setAllowedFileTypes(id, data.mime_types || []);
    }

    // if file_type_ids provided, resolve to mime types and replace allowed file types
    if (Array.isArray(data.file_type_ids)) {
      const fts: any[] = await (prisma as any).fileType.findMany({
        where: { id: { in: data.file_type_ids } },
      });
      const mimes = fts.map((t) => t.mime_type);
      await SubscriptionService.setAllowedFileTypes(id, mimes);
    }

    return pkg;
  },

  deletePackage: async (id: string) => {
    const pkg = await prisma.subscriptionPackage.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    return pkg;
  },

  getAllowedFileTypes: async (packageId: string) => {
    const items = await prisma.packageAllowedFileType.findMany({
      where: { subscriptionPackageId: packageId },
    });
    return items;
  },

  setAllowedFileTypes: async (packageId: string, mimeTypes: string[]) => {
    // replace existing with provided list in a transaction
    const ops = await prisma.$transaction(async (tx) => {
      await tx.packageAllowedFileType.deleteMany({
        where: { subscriptionPackageId: packageId },
      });
      const creates = mimeTypes.map((m) =>
        tx.packageAllowedFileType.create({
          data: { subscriptionPackageId: packageId, mime_type: m as any },
        })
      );
      return await Promise.all(creates);
    });
    return ops;
  },

  deleteAllowedFileType: async (id: string) => {
    const item = await prisma.packageAllowedFileType.delete({ where: { id } });
    return item;
  },

  // helper to set allowed file types by friendly categories
  setAllowedFileTypesByCategories: async (packageId: string, categories: string[]) => {
    const map: Record<string, string[]> = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
      pdf: ['application/pdf'],
    };

    const mimeTypes = categories.map((c) => map[c.toLowerCase()]).filter(Boolean) as string[][];

    const flat = mimeTypes.flat();
    const unique = Array.from(new Set(flat));
    return await SubscriptionService.setAllowedFileTypes(packageId, unique);
  },

  buySubscription: async (userId: string, packageId: string, userEmail: string, months: number) => {
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
          await redis.set(cacheKey, JSON.stringify(pkg), 'EX', 300);
        } catch (err) {
          // ignore cache set errors
        }
      }
    }

    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, 'Package not found');

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
            currency: 'usd',
            status: 'SUCCESS',
            provider: 'free',
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
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
    months: number
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
          await redis.set(cacheKey, JSON.stringify(pkg), 'EX', 300);
        } catch (err) {
          // ignore cache set errors
        }
      }
    }
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, 'Package not found');
    const active = await prisma.userSubscription.findFirst({
      where: { userId, is_active: true },
    });
    if (!active) throw new ApiError(httpStatus.BAD_REQUEST, 'No active subscription to update');
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
            currency: 'usd',
            status: 'SUCCESS',
            provider: 'free',
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
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
        action: 'update',
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
    if (!active) throw new ApiError(httpStatus.NOT_FOUND, 'No active subscription found');

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

  confirmStripePayment: async (sessionId: string, userId: string) => {
    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Stripe session not found');
    }

    // Verify the session belongs to this user via metadata
    if (session.metadata?.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Session does not belong to this user');
    }

    // Check payment status
    if (session.payment_status !== 'paid') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Payment not completed. Status: ' + session.payment_status
      );
    }

    const { packageId, months: monthsStr, action } = session.metadata || {};
    const months = Number(monthsStr) || 1;

    if (!packageId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid session metadata: missing packageId');
    }

    // Get package details
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Package not found');
    }

    const amount = pkg.price ? Number(pkg.price) * months : 0;

    const startedAt = new Date();

    // Calculate end date reliably: same day next X months
    const endedAt = new Date(startedAt);
    endedAt.setMonth(endedAt.getMonth() + months);

    let userSubscription;

    if (action === 'update') {
      // Update existing subscription
      const active = await prisma.userSubscription.findFirst({
        where: { userId, is_active: true },
      });

      if (!active) {
        throw new ApiError(httpStatus.NOT_FOUND, 'No active subscription to update');
      }

      const [updated, billing] = await prisma.$transaction([
        prisma.userSubscription.update({
          where: { id: active.id },
          data: {
            packageId,
            started_at: startedAt,
            ended_at: endedAt,
            is_active: true,
          },
          include: { package: true },
        }),
        prisma.billingTransaction.create({
          data: {
            userId,
            subscriptionId: active.id,
            amount,
            currency: 'usd',
            status: 'SUCCESS',
            provider: 'stripe',
            reference: session.payment_intent as string,
            paid_at: new Date(),
          },
        }),
      ]);

      userSubscription = updated;
    } else {
      // Create new subscription (default action or 'buy')
      // If there is an existing active subscription, deactivate it first
      const existingActive = await prisma.userSubscription.findFirst({
        where: { userId, is_active: true },
      });

      const txResult = await prisma.$transaction(async (tx) => {
        if (existingActive) {
          await tx.userSubscription.update({
            where: { id: existingActive.id },
            data: { is_active: false, ended_at: new Date() },
          });
        }

        const created = await tx.userSubscription.create({
          data: {
            userId,
            packageId,
            started_at: startedAt,
            ended_at: endedAt,
            is_active: true,
          },
          include: { package: true },
        });

        const billing = await tx.billingTransaction.create({
          data: {
            userId,
            subscriptionId: created.id,
            amount,
            currency: 'usd',
            status: 'SUCCESS',
            provider: 'stripe',
            reference: session.payment_intent as string,
            paid_at: new Date(),
          },
        });

        return { created, billing };
      });

      userSubscription = txResult.created;
    }

    // Invalidate cache of user data
    try {
      await redis.del(`user:${userId}`);
    } catch (err) {
      // ignore cache errors
    }

    return userSubscription;
  },
};

export default SubscriptionService;
