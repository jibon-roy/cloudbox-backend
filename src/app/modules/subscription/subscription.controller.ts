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

const getAllPackagesAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getAllPackagesAdmin();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All packages fetched (admin)",
    data: result,
  });
});

const buySubscription = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const packageId = req.params.id as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });

  const months = Number(req.body?.months) || 1;

  const result = await SubscriptionService.buySubscription(
    user.id,
    packageId,
    user.email,
    months,
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

    const months = Number(req.body?.months) || 1;

    const result = await SubscriptionService.updateUserSubscription(
      user.id,
      packageId,
      user.email,
      months,
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

const getAllowedFileTypes = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const items = await SubscriptionService.getAllowedFileTypes(id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Allowed file types fetched",
    data: items,
  });
});

const setAllowedFileTypes = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const types: string[] = req.body?.mime_types ?? [];
  const items = await SubscriptionService.setAllowedFileTypes(id, types);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Allowed file types set",
    data: items,
  });
});

const setAllowedFileTypesByCategories = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const categories: string[] = req.body?.categories ?? [];
    const items = await SubscriptionService.setAllowedFileTypesByCategories(
      id,
      categories,
    );
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Allowed file types set by categories",
      data: items,
    });
  },
);

const deleteAllowedFileType = catchAsync(
  async (req: Request, res: Response) => {
    const typeId = req.params.typeId as string;
    const item = await SubscriptionService.deleteAllowedFileType(typeId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Allowed file type deleted",
      data: item,
    });
  },
);

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
  getAllPackagesAdmin,
  getAllowedFileTypes,
  setAllowedFileTypes,
  deleteAllowedFileType,
  setAllowedFileTypesByCategories,
};

export default SubscriptionController;
