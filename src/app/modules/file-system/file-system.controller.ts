import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import FileService from "../file/file.service";
import { prisma } from "../../../lib/prisma";

const getFileSystem = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id)
    return res.status(401).send({ message: "Unauthorized" });

  // fetch all folders and files for user and build tree
  const folders = await (
    await import("../../../lib/prisma")
  ).prisma.folder.findMany({ where: { userId: user.id, is_deleted: false } });
  const files = await (
    await import("../../../lib/prisma")
  ).prisma.file.findMany({ where: { userId: user.id, is_deleted: false } });

  const map: Record<string, any> = {};
  folders.forEach((f: any) => (map[f.id] = { ...f, children: [], files: [] }));

  const roots: any[] = [];
  folders.forEach((f: any) => {
    if (f.parentId && map[f.parentId]) map[f.parentId].children.push(map[f.id]);
    else roots.push(map[f.id]);
  });

  files.forEach((fi: any) => {
    if (fi.folderId && map[fi.folderId]) map[fi.folderId].files.push(fi);
    else roots.push({ file: fi });
  });

  // Optionally include share links if requested. This performs batched queries to avoid N+1.
  if (String(req.query.includeShare) === "true") {
    const folderIds = folders.map((f: any) => f.id);
    const fileIds = files.map((fi: any) => fi.id);
    const pubs = await prisma.publicShare.findMany({
      where: {
        is_active: true,
        OR: [
          { folderId: { in: folderIds.length ? folderIds : ["__none__"] } },
          { fileId: { in: fileIds.length ? fileIds : ["__none__"] } },
        ],
      },
    });
    const folderMap: Record<string, any> = {};
    const fileMap: Record<string, any> = {};
    pubs.forEach((p) => {
      if (p.folderId) folderMap[p.folderId] = p.public_url;
      if (p.fileId) fileMap[p.fileId] = p.public_url;
    });

    // attach to folder nodes
    folders.forEach((f: any) => {
      (map[f.id] as any).share = folderMap[f.id] ?? null;
    });
    // attach to file nodes
    files.forEach((fi: any) => {
      const node =
        fi.folderId && map[fi.folderId]
          ? map[fi.folderId].files.find((x: any) => x.id === fi.id)
          : null;
      if (node) node.share = fileMap[fi.id] ?? null;
    });
  }

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "File system fetched",
    data: roots,
  });
});

export const FileSystemController = { getFileSystem };

export default FileSystemController;
