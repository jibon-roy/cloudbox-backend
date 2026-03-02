import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { prisma } from '../../../lib/prisma';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import ApiError from '../../../errors/apiError';
import httpStatus from 'http-status';
import { paginationHelpers } from '../../../utils/paginationHelpers';

const resolveStoredFilePath = (storageKey: string | null) => {
  if (!storageKey) return null;
  if (path.isAbsolute(storageKey) && fs.existsSync(storageKey)) return storageKey;

  const localPath = path.join(process.cwd(), 'uploads', storageKey);
  if (fs.existsSync(localPath)) return localPath;

  return null;
};

const buildDownloadBase = (req: Request) =>
  `${req.protocol}://${req.get('host')}/api/v1/filesystem`;

const getFileSystem = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) return res.status(401).send({ message: 'Unauthorized' });

  const { page = 1, limit = 50 } = req.query;
  const { skip, limit: pageLimit } = paginationHelpers.calculatePagination({
    page: Number(page),
    limit: Math.min(Number(limit), 100),
  });

  // fetch all folders and files for user and build tree with pagination
  const foldersList = await (
    await import('../../../lib/prisma')
  ).prisma.folder.findMany({ 
    where: { userId: user.id, is_deleted: false },
    skip,
    take: pageLimit,
    orderBy: { created_at: 'desc' },
  });

  const filesList = await (
    await import('../../../lib/prisma')
  ).prisma.file.findMany({ 
    where: { userId: user.id, is_deleted: false },
    skip,
    take: pageLimit,
    orderBy: { created_at: 'desc' },
  });

  // Get total counts for pagination
  const totalFolders = await prisma.folder.count({
    where: { userId: user.id, is_deleted: false },
  });
  const totalFiles = await prisma.file.count({
    where: { userId: user.id, is_deleted: false },
  });
  const total = totalFolders + totalFiles;

  const downloadBase = buildDownloadBase(req);

  const map: Record<string, any> = {};
  foldersList.forEach(
    (f: any) =>
      (map[f.id] = {
        ...f,
        downloadUrl: `${downloadBase}/download/folder/${f.id}`,
        children: [],
        files: [],
      })
  );

  const roots: any[] = [];
  foldersList.forEach((f: any) => {
    if (f.parentId && map[f.parentId]) map[f.parentId].children.push(map[f.id]);
    else roots.push(map[f.id]);
  });

  filesList.forEach((fi: any) => {
    const fileNode = {
      ...fi,
      downloadUrl: `${downloadBase}/download/file/${fi.id}`,
    };

    if (fi.folderId && map[fi.folderId]) map[fi.folderId].files.push(fi);
    else roots.push({ file: fileNode });
  });

  filesList.forEach((fi: any) => {
    if (fi.folderId && map[fi.folderId]) {
      const idx = map[fi.folderId].files.findIndex((x: any) => x.id === fi.id);
      if (idx !== -1) {
        map[fi.folderId].files[idx] = {
          ...map[fi.folderId].files[idx],
          downloadUrl: `${downloadBase}/download/file/${fi.id}`,
        };
      }
    }
  });

  // Optionally include share links if requested. This performs batched queries to avoid N+1.
  if (String(req.query.includeShare) === 'true') {
    const folderIds = foldersList.map((f: any) => f.id);
    const fileIds = filesList.map((fi: any) => fi.id);
    const pubs = await prisma.publicShare.findMany({
      where: {
        is_active: true,
        OR: [
          { folderId: { in: folderIds.length ? folderIds : ['__none__'] } },
          { fileId: { in: fileIds.length ? fileIds : ['__none__'] } },
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
    foldersList.forEach((f: any) => {
      (map[f.id] as any).share = folderMap[f.id] ?? null;
    });
    // attach to file nodes
    filesList.forEach((fi: any) => {
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
    message: 'File system fetched',
    meta: {
      page: Number(page),
      limit: pageLimit,
      total,
      totalPage: Math.ceil(total / pageLimit),
    },
    data: roots,
  });
});

const getRecentFiles = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) return res.status(401).send({ message: 'Unauthorized' });

  const { page = 1, limit = 20 } = req.query;
  const { skip, limit: pageLimit } = paginationHelpers.calculatePagination({
    page: Number(page),
    limit: Math.min(Number(limit), 100),
  });

  const downloadBase = buildDownloadBase(req);

  // Fetch recent files and folders
  const recentFolders = await prisma.folder.findMany({
    where: { userId: user.id, is_deleted: false },
    orderBy: { created_at: 'desc' },
    skip,
    take: pageLimit,
    select: {
      id: true,
      name: true,
      parentId: true,
      path: true,
      created_at: true,
      updated_at: true,
    },
  });

  const recentFiles = await prisma.file.findMany({
    where: { userId: user.id, is_deleted: false },
    orderBy: { created_at: 'desc' },
    skip,
    take: pageLimit,
    select: {
      id: true,
      name: true,
      folderId: true,
      path: true,
      size_bytes: true,
      created_at: true,
      updated_at: true,
    },
  });

  // Combine and sort by creation time
  const combined = [
    ...recentFolders.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'folder',
      parentId: f.parentId,
      path: f.path,
      created_at: f.created_at,
      updated_at: f.updated_at,
      downloadUrl: `${downloadBase}/download/folder/${f.id}`,
    })),
    ...recentFiles.map((f) => ({
      id: f.id,
      name: f.name,
      type: 'file',
      folderId: f.folderId,
      path: f.path,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
      updated_at: f.updated_at,
      downloadUrl: `${downloadBase}/download/file/${f.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, pageLimit);

  // Get total count for pagination
  const totalFolders = await prisma.folder.count({
    where: { userId: user.id, is_deleted: false },
  });
  const totalFiles = await prisma.file.count({
    where: { userId: user.id, is_deleted: false },
  });
  const total = totalFolders + totalFiles;

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Recent files and folders fetched',
    meta: {
      page: Number(page),
      limit: pageLimit,
      total,
      totalPage: Math.ceil(total / pageLimit),
    },
    data: combined,
  });
});

const downloadFileById = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) return res.status(401).send({ message: 'Unauthorized' });

  const id = req.params.id as string;
  const file = await prisma.file.findFirst({
    where: { id, userId: user.id, is_deleted: false },
  });

  if (!file) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found');
  }

  const storedPath = resolveStoredFilePath(file.storage_key);
  if (!storedPath) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Stored file not found on disk');
  }

  return res.download(storedPath, file.name);
});

const downloadFolderById = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) return res.status(401).send({ message: 'Unauthorized' });

  const id = req.params.id as string;
  const folder = await prisma.folder.findFirst({
    where: { id, userId: user.id, is_deleted: false },
  });

  if (!folder) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Folder not found');
  }

  const foldersList = await prisma.folder.findMany({
    where: {
      userId: user.id,
      is_deleted: false,
      OR: [{ id: folder.id }, { path: { startsWith: `${folder.path}/` } }],
    },
  });
  const folderIds = foldersList.map((f) => f.id);

  const filesList = await prisma.file.findMany({
    where: {
      userId: user.id,
      is_deleted: false,
      folderId: { in: folderIds.length ? folderIds : [folder.id] },
    },
  });

  const zipName = `${folder.name}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, err.message);
  });

  archive.pipe(res);

  for (const file of filesList) {
    const storedPath = resolveStoredFilePath(file.storage_key);
    if (!storedPath) continue;

    const relativeName = file.path?.startsWith(`${folder.path}/`)
      ? file.path.slice(folder.path.length + 1)
      : file.name;

    archive.file(storedPath, { name: relativeName || file.name });
  }

  await archive.finalize();
});

export const FileSystemController = {
  getFileSystem,
  getRecentFiles,
  downloadFileById,
  downloadFolderById,
};

export default FileSystemController;
