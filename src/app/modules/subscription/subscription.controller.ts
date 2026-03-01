import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { SubscriptionService } from "./subscription.service";
import httpStatus from "http-status";

const createPackage = catchAsync(async (req: Request, res: Response) => {
  const data = req.body || {};

  const result = await SubscriptionService.createPackage(data);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Subscription package created",
    data: result,
  });
});

const getAllPackages = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getAllPackages();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Packages fetched",
    data: result,
  });
});

const buySubscription = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const packageId = req.params.id as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });

  const result = await SubscriptionService.buySubscription(
    user.id,
    packageId,
    user.email,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Checkout session created",
    data: result,
  });
});

const updateUserSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const packageId = req.params.id as string;
    if (!user || !user.id)
      return res.status(401).send({ message: "Unauthorized" });

    const result = await SubscriptionService.updateUserSubscription(
      user.id,
      packageId,
      user.email,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Checkout session created for subscription update",
      data: result,
    });
  },
);

const updatePackage = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = req.body || {};

  const result = await SubscriptionService.updatePackage(id, data);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Subscription package updated",
    data: result,
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });

  const result = await SubscriptionService.cancelUserSubscription(user.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Subscription cancelled",
    data: result,
  });
});

const deletePackage = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const result = await SubscriptionService.deletePackage(id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Subscription package deleted",
    data: result,
  });
});

const getUserActiveSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id)
      return res.status(401).send({ message: "Unauthorized" });

    const result = await SubscriptionService.getUserActiveSubscription(user.id);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Active subscription fetched",
      data: result,
    });
  },
);

export const SubscriptionController = {
  createPackage,
  getAllPackages,
  buySubscription,
  updatePackage,
  cancelSubscription,
  deletePackage,
  getUserActiveSubscription,
  updateUserSubscription,
};

export default SubscriptionController;
