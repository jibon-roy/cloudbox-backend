import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import FileService from "./file.service";
import { prisma } from "../../../lib/prisma";

const uploadFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });

  // If multer provided files (multiple), process them; otherwise fall back to
  // legacy metadata-in-body behavior.
  const files = (req as any).files as Express.Multer.File[] | undefined;
  const folderId = (req.body && req.body.folderId) || null;

  const results: any[] = [];

  // helper to compute path based on folder if available
  let folderPath: string | null = null;
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (folder) folderPath = folder.path;
  }

  if (files && files.length > 0) {
    for (const f of files) {
      const name = f.originalname;
      const mime_type = f.mimetype;
      const size_bytes = BigInt(f.size);
      const pathVal = folderPath
        ? `${folderPath}/${f.originalname}`
        : f.originalname;
      const storage_key =
        (f as any).filename || (f as any).path || f.originalname;

      const r = await FileService.uploadFile(user.id, {
        name,
        folderId,
        mime_type,
        size_bytes,
        path: pathVal,
        storage_key,
      });
      results.push(r);
    }

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Files uploaded",
      data: results,
    });

    return;
  }

  // Fallback: single file metadata provided in body
  const { name, mime_type, size_bytes, path, storage_key } = req.body;
  const result = await FileService.uploadFile(user.id, {
    name,
    folderId,
    mime_type,
    size_bytes: BigInt(size_bytes),
    path,
    storage_key,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "File uploaded",
    data: result,
  });
});

const replaceFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const { mime_type, size_bytes, storage_key } = req.body;
  const result = await FileService.replaceFile(user.id, id, {
    mime_type,
    size_bytes: BigInt(size_bytes),
    storage_key,
  });
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File replaced",
    data: result,
  });
});

const deleteFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const result = await FileService.deleteFile(user.id, id);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File deleted",
    data: result,
  });
});

const listFiles = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const filters = req.query || {};
  const items = await FileService.listFiles(user.id, filters);
  // include share links only when explicitly requested to avoid extra queries
  if (String(req.query.includeShare) === "true" && items.length > 0) {
    const ids = items.map((it: any) => it.id);
    const pubs = await prisma.publicShare.findMany({
      where: { fileId: { in: ids }, is_active: true },
    });
    const map: Record<string, any> = {};
    pubs.forEach((p) => {
      if (p.fileId) map[p.fileId] = p;
    });
    items.forEach(
      (it: any) => (it.share = map[it.id] ? map[it.id].public_url : null),
    );
  }
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Files fetched",
    data: items,
  });
});

const getFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const item = await FileService.getFileById(user.id, id);
  if (String(req.query.includeShare) === "true") {
    const pub = await prisma.publicShare.findFirst({
      where: { fileId: id, is_active: true },
    });
    (item as any).share = pub ? pub.public_url : null;
  }
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File fetched",
    data: item,
  });
});

const moveFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const { targetFolderId } = req.body;
  const item = await FileService.moveFile(user.id, id, targetFolderId ?? null);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "File moved",
    data: item,
  });
});

const copyFile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });
  const id = req.params.id as string;
  const { targetFolderId } = req.body;
  const item = await FileService.copyFile(user.id, id, targetFolderId ?? null);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "File copied",
    data: item,
  });
});

export const FileController = {
  uploadFile,
  replaceFile,
  deleteFile,
  listFiles,
  getFile,
  moveFile,
  copyFile,
};

export default FileController;
