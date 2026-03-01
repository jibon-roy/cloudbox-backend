import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import BillingService from "./billing.service";

const getAllBillings = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query || {};
  const result = await BillingService.getAllBillings(filters);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Billings fetched",
    data: result,
  });
});

const getUserBillings = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const filters = req.query || {};
  const result = await BillingService.getUserBillings(user.id, filters);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User billings fetched",
    data: result,
  });
});

const changeBillingStatus = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const status = req.body?.status as string;
  const result = await BillingService.changeBillingStatus(id, status);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Billing status updated",
    data: result,
  });
});

const confirmPaymentByReference = catchAsync(
  async (req: Request, res: Response) => {
    const reference = req.params.reference as string;
    const result = await BillingService.confirmPaymentByReference(reference);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Billing confirmed",
      data: result,
    });
  },
);

const getAllActiveSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const filters = req.query || {};
    const result = await BillingService.getAllActiveSubscriptions(filters);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Active subscriptions fetched",
      data: result,
    });
  },
);

const changeSubscriptionStatus = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const is_active = req.body?.is_active as boolean;
    const result = await BillingService.changeSubscriptionStatus(id, is_active);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Subscription status updated",
      data: result,
    });
  },
);

export const BillingController = {
  getAllBillings,
  getUserBillings,
  changeBillingStatus,
  confirmPaymentByReference,
  getAllActiveSubscriptions,
  changeSubscriptionStatus,
};

export default BillingController;
