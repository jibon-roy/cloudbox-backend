import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import StorageService from "./storage.service";

const getMyStorage = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const usage = await StorageService.getUserStorage(user.id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Storage fetched",
    data: usage,
  });
});

const getAllStorage = catchAsync(async (req: Request, res: Response) => {
  const data = await StorageService.getAllStorageAggregate();
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Aggregate storage fetched",
    data,
  });
});

export const StorageController = { getMyStorage, getAllStorage };

export default StorageController;
