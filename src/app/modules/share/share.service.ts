import { prisma } from "../../../lib/prisma";
import ApiError from "../../../errors/apiError";
import httpStatus from "http-status";

const genToken = () =>
  `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const ShareService = {
  createFileShare: async (
    userId: string,
    fileId: string,
    data: {
      sharedWithUserId?: string;
      permission?: "VIEW" | "EDIT";
      is_public?: boolean;
      expires_at?: string | null;
    },
  ) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    if (data.sharedWithUserId) {
      const share = await prisma.fileShare.create({
        data: {
          fileId,
          sharedWithUserId: data.sharedWithUserId,
          permission: data.permission ?? "VIEW",
          createdById: userId,
        },
      });
      return share;
    }

    if (data.is_public) {
      const token = genToken();
      const pub = await prisma.publicShare.create({
        data: {
          fileId,
          public_token: token,
          public_url: `/public/${token}`,
          is_active: true,
          expires_at: data.expires_at ? new Date(data.expires_at) : null,
          createdById: userId,
        },
      });
      return pub;
    }

    throw new ApiError(httpStatus.BAD_REQUEST, "No share target provided");
  },

  createFolderShare: async (
    userId: string,
    folderId: string,
    data: {
      sharedWithUserId?: string;
      permission?: "VIEW" | "EDIT";
      is_public?: boolean;
      expires_at?: string | null;
    },
  ) => {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    if (data.sharedWithUserId) {
      const share = await prisma.folderShare.create({
        data: {
          folderId,
          sharedWithUserId: data.sharedWithUserId,
          permission: data.permission ?? "VIEW",
          createdById: userId,
        },
      });
      return share;
    }

    if (data.is_public) {
      const token = genToken();
      const pub = await prisma.publicShare.create({
        data: {
          folderId,
          public_token: token,
          public_url: `/public/${token}`,
          is_active: true,
          expires_at: data.expires_at ? new Date(data.expires_at) : null,
          createdById: userId,
        },
      });
      return pub;
    }

    throw new ApiError(httpStatus.BAD_REQUEST, "No share target provided");
  },

  getPublicByToken: async (token: string) => {
    const pub = await prisma.publicShare.findUnique({
      where: { public_token: token },
    });
    if (!pub || !pub.is_active)
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Public share not found or inactive",
      );
    if (pub.expires_at && pub.expires_at < new Date())
      throw new ApiError(httpStatus.GONE, "Public share expired");

    if (pub.fileId) {
      const file = await prisma.file.findUnique({ where: { id: pub.fileId } });
      return { ...pub, file };
    }

    if (pub.folderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: pub.folderId },
      });
      if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");

      const files: any[] = [];

      const collect = async (fid: string) => {
        const f = await prisma.file.findMany({
          where: { folderId: fid, is_deleted: false },
        });
        for (const ff of f) files.push(ff);
        const children = await prisma.folder.findMany({
          where: { parentId: fid, is_deleted: false },
        });
        for (const c of children) await collect(c.id);
      };

      await collect(folder.id);
      return { ...pub, folder, files };
    }

    return pub;
  },

  getOrCreateFilePublicShare: async (
    userId: string,
    fileId: string,
    expires_at?: string | null,
  ) => {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new ApiError(httpStatus.NOT_FOUND, "File not found");
    if (file.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    const existing = await prisma.publicShare.findFirst({
      where: { fileId, is_active: true },
    });
    if (existing) return existing;

    const token = genToken();
    const pub = await prisma.publicShare.create({
      data: {
        fileId,
        public_token: token,
        public_url: `/public/${token}`,
        is_active: true,
        expires_at: expires_at ? new Date(expires_at) : null,
        createdById: userId,
      },
    });
    return pub;
  },

  getOrCreateFolderPublicShare: async (
    userId: string,
    folderId: string,
    expires_at?: string | null,
  ) => {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new ApiError(httpStatus.NOT_FOUND, "Folder not found");
    if (folder.userId !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");

    const existing = await prisma.publicShare.findFirst({
      where: { folderId, is_active: true },
    });
    if (existing) return existing;

    const token = genToken();
    const pub = await prisma.publicShare.create({
      data: {
        folderId,
        public_token: token,
        public_url: `/public/${token}`,
        is_active: true,
        expires_at: expires_at ? new Date(expires_at) : null,
        createdById: userId,
      },
    });
    return pub;
  },

  getFileShare: async (userId: string, shareId: string) => {
    const share = await prisma.fileShare.findUnique({ where: { id: shareId } });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    return share;
  },

  getFolderShare: async (userId: string, shareId: string) => {
    const share = await prisma.folderShare.findUnique({
      where: { id: shareId },
    });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    return share;
  },

  updateFileShare: async (userId: string, shareId: string, data: any) => {
    const share = await prisma.fileShare.findUnique({ where: { id: shareId } });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    const updateData: any = {};
    if (data.permission !== undefined) updateData.permission = data.permission;
    const updated = await prisma.fileShare.update({
      where: { id: shareId },
      data: updateData,
    });
    return updated;
  },

  updateFolderShare: async (userId: string, shareId: string, data: any) => {
    const share = await prisma.folderShare.findUnique({
      where: { id: shareId },
    });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    const updateData: any = {};
    if (data.permission !== undefined) updateData.permission = data.permission;
    const updated = await prisma.folderShare.update({
      where: { id: shareId },
      data: updateData,
    });
    return updated;
  },

  deleteFileShare: async (userId: string, shareId: string) => {
    const share = await prisma.fileShare.findUnique({ where: { id: shareId } });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    await prisma.fileShare.delete({ where: { id: shareId } });
    return { success: true };
  },

  deleteFolderShare: async (userId: string, shareId: string) => {
    const share = await prisma.folderShare.findUnique({
      where: { id: shareId },
    });
    if (!share) throw new ApiError(httpStatus.NOT_FOUND, "Share not found");
    if (share.createdById !== userId)
      throw new ApiError(httpStatus.FORBIDDEN, "Not owner");
    await prisma.folderShare.delete({ where: { id: shareId } });
    return { success: true };
  },
};

export default ShareService;
