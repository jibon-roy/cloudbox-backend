import { prisma } from "../../../lib/prisma";
import stripe from "../../../helpers/stripe/stripe";
import config from "../../../config";
import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";

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
  ) => {
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, "Package not found");
    if (!pkg.price)
      throw new ApiError(httpStatus.BAD_REQUEST, "Package price is not set");

    const amountInCents = Math.round(Number(pkg.price) * 100);

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
      },
    });

    return { url: session.url, id: session.id };
  },

  updateUserSubscription: async (
    userId: string,
    packageId: string,
    userEmail: string,
  ) => {
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg) throw new ApiError(httpStatus.NOT_FOUND, "Package not found");
    if (!pkg.price)
      throw new ApiError(httpStatus.BAD_REQUEST, "Package price is not set");

    const active = await prisma.userSubscription.findFirst({
      where: { userId, is_active: true },
    });
    if (!active)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "No active subscription to update",
      );

    const amountInCents = Math.round(Number(pkg.price) * 100);

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
