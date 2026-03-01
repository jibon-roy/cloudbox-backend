import { prisma } from "../../../lib/prisma";
import ApiError from "../../../errors/apiError";
import httpStatus from "http-status";

const ensureActiveSubscription = async (userId: string) => {
  const active = await prisma.userSubscription.findFirst({
    where: { userId, is_active: true },
  });
  if (!active)
    throw new ApiError(httpStatus.PAYMENT_REQUIRED, "No active subscription");
  return active;
};

export const FileService = {
  uploadFile: async (
    userId: string,
    data: {
      name: string;
      folderId?: string | null;
      mime_type: string;
      size_bytes: bigint;
      path: string;
      storage_key?: string;
    },
  ) => {
    const active = await ensureActiveSubscription(userId);

    // check package limits
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: active.packageId },
    });
    if (!pkg)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subscription package not found",
      );

    if (
      pkg.max_file_size_mb &&
      Number(data.size_bytes) > pkg.max_file_size_mb * 1024 * 1024
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "File exceeds max file size for your package",
      );

    // check storage usage
    const usage = await prisma.storageUsage.findUnique({ where: { userId } });
    const currentBytes = usage
      ? BigInt(usage.total_storage_bytes.toString())
      : BigInt(0);
    const newTotal = currentBytes + data.size_bytes;
    if (
      pkg.max_storage_mb &&
      newTotal > BigInt(pkg.max_storage_mb) * BigInt(1024 * 1024)
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Exceeds max storage for your package",
      );

    // check total file limit
    if ((pkg as any).total_file_limit) {
      const totalFiles = usage ? Number(usage.total_files) : 0;
      if (totalFiles + 1 > Number((pkg as any).total_file_limit))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Total file limit reached for your package",
        );
    }

    // check files per folder
    if ((pkg as any).files_per_folder && data.folderId) {
      const filesInFolder = await prisma.file.count({
        where: { folderId: data.folderId, is_deleted: false },
      });
      if (filesInFolder + 1 > Number((pkg as any).files_per_folder))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Files per folder limit exceeded for your package",
        );
    }

    // check allowed file types
    const allowed = await prisma.packageAllowedFileType.findMany({
      where: { subscriptionPackageId: pkg.id },
    });
    if (allowed.length > 0) {
      const ok = allowed.some((a) => a.mime_type === data.mime_type);
      if (!ok)
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "MIME type not allowed by your package",
        );
    }

    // create file and update storage usage in transaction
    const [file, su] = await prisma.$transaction([
      prisma.file.create({
        data: {
          userId,
          folderId: data.folderId ?? null,
          name: data.name,
          path: data.path,
          mime_type: data.mime_type,
          size_bytes: data.size_bytes as any,
          storage_key: data.storage_key ?? null,
        },
      }),
      prisma.storageUsage.upsert({
        where: { userId },
        create: {
          userId,
          total_storage_bytes: data.size_bytes as any,
          total_files: 1,
          total_folders: 0,
        },
        update: {
          total_storage_bytes: { increment: data.size_bytes as any },
          total_files: { increment: 1 } as any,
        },
      }),
    ]);

    return { file, storageUsage: su };
  },

  replaceFile: async (
    userId: string,
    fileId: string,
    newData: { mime_type: string; size_bytes: bigint; storage_key?: string },
  ) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    const active = await ensureActiveSubscription(userId);
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: active.packageId },
    });
    if (!pkg)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subscription package not found",
      );

    if (
      pkg.max_file_size_mb &&
      Number(newData.size_bytes) > pkg.max_file_size_mb * 1024 * 1024
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "File exceeds max file size for your package",
      );

    // adjust storage usage by difference
    const oldSize = BigInt(file.size_bytes.toString());
    const diff = newData.size_bytes - oldSize;

    await prisma.$transaction([
      prisma.file.update({
        where: { id: fileId },
        data: {
          mime_type: newData.mime_type,
          size_bytes: newData.size_bytes as any,
          storage_key: newData.storage_key ?? file.storage_key,
        },
      }),
      prisma.storageUsage.update({
        where: { userId },
        data: { total_storage_bytes: { increment: diff as any } as any },
      }),
    ]);

    return { success: true };
  },

  deleteFile: async (userId: string, fileId: string) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    await prisma.$transaction([
      prisma.file.update({ where: { id: fileId }, data: { is_deleted: true } }),
      prisma.storageUsage.update({
        where: { userId },
        data: {
          total_storage_bytes: { decrement: file.size_bytes as any },
          total_files: { decrement: 1 } as any,
        },
      }),
    ]);

    return { success: true };
  },

  listFiles: async (userId: string, filters: any) => {
    const where: any = { userId, is_deleted: false };
    if (filters.folderId) where.folderId = filters.folderId;
    const items = await prisma.file.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return items;
  },

  getFileById: async (userId: string, fileId: string) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId === userId) return file;
    // TODO: check share permissions (folder/file shares) - for now deny
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Not authorized to access this file",
    );
  },

  moveFile: async (
    userId: string,
    fileId: string,
    targetFolderId: string | null,
  ) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    if (targetFolderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: targetFolderId },
      });
      if (!folder || folder.userId !== userId)
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid target folder");
    }

    // update path (simple approach: keep same name, recompute path)
    let newPath = file.name;
    if (targetFolderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: targetFolderId },
      });
      if (folder) newPath = `${folder.path}/${file.name}`;
    }

    const updated = await prisma.file.update({
      where: { id: fileId },
      data: { folderId: targetFolderId, path: newPath },
    });
    return updated;
  },

  copyFile: async (
    userId: string,
    fileId: string,
    targetFolderId: string | null,
  ) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    // create duplicate row; storage_key should be duplicated or new depending on storage backend
    const newStorageKey = file.storage_key
      ? `${file.storage_key}_copy_${Date.now()}`
      : null;

    // check package limits before copying
    const active = await ensureActiveSubscription(userId);
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: active.packageId },
    });
    if (!pkg)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subscription package not found",
      );

    const usage = await prisma.storageUsage.findUnique({ where: { userId } });
    // total file limit
    if ((pkg as any).total_file_limit) {
      const totalFiles = usage ? Number(usage.total_files) : 0;
      if (totalFiles + 1 > Number((pkg as any).total_file_limit))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Total file limit reached for your package",
        );
    }
    // files per folder
    if ((pkg as any).files_per_folder && targetFolderId) {
      const filesInFolder = await prisma.file.count({
        where: { folderId: targetFolderId, is_deleted: false },
      });
      if (filesInFolder + 1 > Number((pkg as any).files_per_folder))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Files per folder limit exceeded for your package",
        );
    }

    const [newFile, su] = await prisma.$transaction([
      prisma.file.create({
        data: {
          userId,
          folderId: targetFolderId ?? null,
          name: file.name,
          path: targetFolderId ? `${targetFolderId}/${file.name}` : file.path,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes as any,
          storage_key: newStorageKey,
        },
      }),
      prisma.storageUsage.upsert({
        where: { userId },
        create: {
          userId,
          total_storage_bytes: file.size_bytes as any,
          total_files: 1,
          total_folders: 0,
        },
        update: {
          total_storage_bytes: { increment: file.size_bytes as any },
          total_files: { increment: 1 } as any,
        },
      }),
    ]);

    return { newFile, storageUsage: su };
  },
};

export default FileService;
