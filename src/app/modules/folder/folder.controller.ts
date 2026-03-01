import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import FolderService from "./folder.service";
import { prisma } from "../../../lib/prisma";

const createFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const { name, parentId } = req.body;
  const result = await FolderService.createFolder(user.id, { name, parentId });
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Folder created",
    data: result,
  });
});

const listFolders = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const items = await FolderService.listFolders(user.id, req.query || {});
  if (String(req.query.includeShare) === "true" && items.length > 0) {
    const ids = items.map((it: any) => it.id);
    const pubs = await prisma.publicShare.findMany({
      where: { folderId: { in: ids }, is_active: true },
    });
    const map: Record<string, any> = {};
    pubs.forEach((p) => {
      if (p.folderId) map[p.folderId] = p;
    });
    items.forEach(
      (it: any) => (it.share = map[it.id] ? map[it.id].public_url : null),
    );
  }
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folders fetched",
    data: items,
  });
});

const getFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const item = await FolderService.getFolder(user.id, id);
  if (String(req.query.includeShare) === "true") {
    const pub = await prisma.publicShare.findFirst({
      where: { folderId: id, is_active: true },
    });
    (item as any).share = pub ? pub.public_url : null;
  }
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder fetched",
    data: item,
  });
});

const deleteFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const result = await FolderService.deleteFolderRecursive(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder deleted",
    data: result,
  });
});

const moveFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const { targetParentId } = req.body;
  const result = await FolderService.moveFolder(
    user.id,
    id,
    targetParentId ?? null,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Folder moved",
    data: result,
  });
});

const copyFolder = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const { targetParentId } = req.body;
  const result = await FolderService.copyFolderRecursive(
    user.id,
    id,
    targetParentId ?? null,
  );
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Folder copied",
    data: result,
  });
});

export const FolderController = {
  createFolder,
  listFolders,
  getFolder,
  deleteFolder,
  moveFolder,
  copyFolder,
};

export default FolderController;
