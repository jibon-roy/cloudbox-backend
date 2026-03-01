import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import { ShareService } from "./share.service";

const createFileShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const fileId = req.params.id as string;
  const data = req.body || {};
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.createFileShare(user.id, fileId, data);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "File shared",
    data: result,
  });
});

const createFolderShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const folderId = req.params.id as string;
  const data = req.body || {};
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.createFolderShare(user.id, folderId, data);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Folder shared",
    data: result,
  });
});

const getPublic = catchAsync(async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const result = await ShareService.getPublicByToken(token);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Public share fetched",
    data: result,
  });
});

const getShareLinkFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const fileId = req.params.id as string;
  const expires = req.query.expires_at as string | undefined;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.getOrCreateFilePublicShare(
    user.id,
    fileId,
    expires ?? null,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Share link",
    data: result,
  });
});

const getShareLinkFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const folderId = req.params.id as string;
  const expires = req.query.expires_at as string | undefined;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.getOrCreateFolderPublicShare(
    user.id,
    folderId,
    expires ?? null,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Share link",
    data: result,
  });
});

const getFileShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.getFileShare(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File share fetched",
    data: result,
  });
});

const getFolderShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.getFolderShare(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder share fetched",
    data: result,
  });
});

const updateFileShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  const data = req.body || {};
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.updateFileShare(user.id, id, data);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File share updated",
    data: result,
  });
});

const updateFolderShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  const data = req.body || {};
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.updateFolderShare(user.id, id, data);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder share updated",
    data: result,
  });
});

const deleteFileShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.deleteFileShare(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File share deleted",
    data: result,
  });
});

const deleteFolderShare = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = req.params.shareId as string;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const result = await ShareService.deleteFolderShare(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder share deleted",
    data: result,
  });
});

export const ShareController = {
  createFileShare,
  createFolderShare,
  getPublic,
  getFileShare,
  getFolderShare,
  updateFileShare,
  updateFolderShare,
  deleteFileShare,
  deleteFolderShare,
  getShareLinkFile,
  getShareLinkFolder,
};

export default ShareController;
