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

export const FolderService = {
  createFolder: async (
    userId: string,
    data: { name: string; parentId?: string | null; path?: string },
  ) => {
    const active = await ensureActiveSubscription(userId);
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: active.packageId },
    });
    if (!pkg)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subscription package not found",
      );
    if (pkg.max_folders) {
      const count = await prisma.folder.count({
        where: { userId, is_deleted: false },
      });
      if (count >= pkg.max_folders)
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Folder limit reached for your package",
        );
    }

    let newPath = data.path ?? data.name;
    if (data.parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: data.parentId },
      });
      if (!parent || parent.userId !== userId)
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parent folder");
      newPath = `${parent.path}/${data.name}`;

      // check nesting level
      const parentDepth = parent.path ? parent.path.split("/").length : 1;
      const newDepth = parentDepth + 1;
      if (
        (pkg as any).max_nesting_level &&
        newDepth > Number((pkg as any).max_nesting_level)
      )
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Max folder nesting level exceeded for your package",
        );
    }

    const created = await prisma.folder.create({
      data: {
        userId,
        parentId: data.parentId ?? null,
        name: data.name,
        path: newPath,
      },
    });

    // increment total_folders
    await prisma.storageUsage.upsert({
      where: { userId },
      create: {
        userId,
        total_storage_bytes: 0,
        total_files: 0,
        total_folders: 1,
      },
      update: { total_folders: { increment: 1 } as any },
    });

    return created;
  },

  listFolders: async (userId: string, filters: any) => {
    const where: any = { userId, is_deleted: false };
    if (filters.parentId) where.parentId = filters.parentId;
    const items = await prisma.folder.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    return items;
  },

  getFolder: async (userId: string, id: string) => {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId === userId) return folder;
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Not authorized to access this folder",
    );
  },

  deleteFolderRecursive: async (userId: string, id: string) => {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    // find all nested folders and files
    const folders = await prisma.folder.findMany({
      where: { path: { contains: folder.path }, userId },
    });
    const folderIds = folders.map((f) => f.id);
    const files = await prisma.file.findMany({
      where: { folderId: { in: folderIds }, userId, is_deleted: false },
    });

    // compute sums
    const totalBytes = files.reduce(
      (acc, f) => acc + BigInt(f.size_bytes.toString()),
      BigInt(0),
    );
    const totalFiles = files.length;
    const totalFolders = folderIds.length;

    await prisma.$transaction([
      prisma.folder.updateMany({
        where: { id: { in: folderIds } },
        data: { is_deleted: true },
      }),
      prisma.file.updateMany({
        where: { folderId: { in: folderIds } },
        data: { is_deleted: true },
      }),
      prisma.storageUsage.update({
        where: { userId },
        data: {
          total_storage_bytes: { decrement: totalBytes as any },
          total_files: { decrement: totalFiles } as any,
          total_folders: { decrement: totalFolders } as any,
        },
      }),
    ]);

    return {
      success: true,
      deleted: { folders: folderIds.length, files: files.length },
    };
  },

  moveFolder: async (
    userId: string,
    id: string,
    targetParentId: string | null,
  ) => {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    const activeSub = await ensureActiveSubscription(userId);
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: activeSub.packageId },
    });

    if (targetParentId) {
      const target = await prisma.folder.findUnique({
        where: { id: targetParentId },
      });
      if (!target || target.userId !== userId)
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid target parent");

      // prevent circular: ensure target is not inside folder
      if (target.path.startsWith(folder.path))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Cannot move folder inside its descendant",
        );

      // check nesting constraints for subtree
      const oldBaseDepth = folder.path ? folder.path.split("/").length : 1;
      const targetBaseDepth = target.path ? target.path.split("/").length : 1;
      const children = await prisma.folder.findMany({
        where: { path: { contains: folder.path }, userId },
      });
      if ((pkg as any).max_nesting_level) {
        const maxNest = Number((pkg as any).max_nesting_level);
        for (const c of children) {
          const childDepth = c.path.split("/").length;
          const depthOffset = childDepth - oldBaseDepth;
          const newDepth = targetBaseDepth + 1 + depthOffset;
          if (newDepth > maxNest)
            throw new ApiError(
              httpStatus.BAD_REQUEST,
              "Move would exceed max nesting level for your package",
            );
        }
      }

      // update path for folder and its children
      const oldPath = folder.path;
      const newPath = `${target.path}/${folder.name}`;

      const updates = children.map((c) => {
        const updatedPath = c.path.replace(oldPath, newPath);
        return prisma.folder.update({
          where: { id: c.id },
          data: { path: updatedPath },
        });
      });

      await prisma.$transaction([
        prisma.folder.update({
          where: { id },
          data: { parentId: targetParentId, path: newPath },
        }),
        ...updates,
      ]);
    } else {
      // moving to root
      const children = await prisma.folder.findMany({
        where: { path: { contains: folder.path }, userId },
      });
      const oldPath = folder.path;
      const newPath = folder.name;
      const updates = children.map((c) => {
        const updatedPath = c.path.replace(oldPath, newPath);
        return prisma.folder.update({
          where: { id: c.id },
          data: { path: updatedPath },
        });
      });
      await prisma.$transaction([
        prisma.folder.update({
          where: { id },
          data: { parentId: null, path: newPath },
        }),
        ...updates,
      ]);
    }

    return { success: true };
  },

  copyFolderRecursive: async (
    userId: string,
    id: string,
    targetParentId: string | null,
  ) => {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    const activeSub = await ensureActiveSubscription(userId);
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: activeSub.packageId },
    });

    const folders = await prisma.folder.findMany({
      where: { path: { contains: folder.path }, userId },
    });
    const folderIds = folders.map((f) => f.id);
    const files = await prisma.file.findMany({
      where: { folderId: { in: folderIds }, userId, is_deleted: false },
    });

    // enforce package-level limits for copying
    const usage = await prisma.storageUsage.findUnique({ where: { userId } });
    if ((pkg as any).max_folders) {
      const existingFolders = await prisma.folder.count({
        where: { userId, is_deleted: false },
      });
      if (existingFolders + folders.length > Number((pkg as any).max_folders))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Folder limit exceeded for your package",
        );
    }
    if ((pkg as any).total_file_limit) {
      const existingFiles = usage ? Number(usage.total_files) : 0;
      if (existingFiles + files.length > Number((pkg as any).total_file_limit))
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Total file limit exceeded for your package",
        );
    }

    // check nesting level constraints
    if ((pkg as any).max_nesting_level) {
      const baseDepth = folder.path ? folder.path.split("/").length : 1;
      const targetBaseDepth = targetParentId
        ? (await prisma.folder.findUnique({
            where: { id: targetParentId },
          }))!.path.split("/").length + 1
        : 1;
      const maxNest = Number((pkg as any).max_nesting_level);
      for (const c of folders) {
        const childDepth = c.path.split("/").length;
        const offset = childDepth - baseDepth;
        const newDepth = targetBaseDepth + offset;
        if (newDepth > maxNest)
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Copy would exceed max nesting level for your package",
          );
      }
    }

    // check files_per_folder for target parent for the root folder copy
    if ((pkg as any).files_per_folder && targetParentId) {
      const filesInTargetParent = await prisma.file.count({
        where: { folderId: targetParentId, is_deleted: false },
      });
      const rootFiles = await prisma.file.count({
        where: { folderId: folder.id, is_deleted: false },
      });
      if (
        filesInTargetParent + rootFiles >
        Number((pkg as any).files_per_folder)
      )
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Files per folder limit exceeded for target folder",
        );
    }

    // naive approach: create copies one by one and track mapping
    const folderMap: Record<string, string> = {};
    const createdFolderIds: string[] = [];
    for (const f of folders) {
      const newPath = targetParentId ? `${targetParentId}/${f.name}` : f.name;
      const created = await prisma.folder.create({
        data: { userId, parentId: null, name: f.name, path: newPath },
      });
      folderMap[f.id] = created.id;
      createdFolderIds.push(created.id);
    }

    let totalBytes = BigInt(0);
    let totalFiles = 0;
    let totalFolders = createdFolderIds.length;

    for (const fi of files) {
      if (!fi.folderId) continue;
      const newFolderId = folderMap[fi.folderId];
      if (!newFolderId) continue;
      await prisma.file.create({
        data: {
          userId,
          folderId: newFolderId,
          name: fi.name,
          path: `${newFolderId}/${fi.name}`,
          mime_type: fi.mime_type,
          size_bytes: fi.size_bytes as any,
          storage_key: fi.storage_key,
        },
      });
      totalBytes += BigInt(fi.size_bytes.toString());
      totalFiles += 1;
    }

    await prisma.storageUsage.upsert({
      where: { userId },
      create: {
        userId,
        total_storage_bytes: totalBytes as any,
        total_files: totalFiles,
        total_folders: totalFolders,
      },
      update: {
        total_storage_bytes: { increment: totalBytes as any },
        total_files: { increment: totalFiles } as any,
        total_folders: { increment: totalFolders } as any,
      },
    });

    return {
      success: true,
      created: { folders: totalFolders, files: totalFiles },
    };
  },
};

export default FolderService;
