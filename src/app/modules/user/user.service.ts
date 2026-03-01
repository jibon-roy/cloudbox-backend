import { prisma } from "../../../lib/prisma";
import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import { sanitizeUser } from "../../../shared/sanitizeUser";
import fs from "fs";
import path from "path";

async function updateProfile(
  userId: string,
  data: { name?: string },
  file?: Express.Multer.File,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  const updates: any = {};
  if (data.name) updates.name = data.name;
  if (file) {
    // remove old avatar file if exists and is a local file
    if (user.avatar_url && user.avatar_url.startsWith("/uploads")) {
      const oldPath = path.join(
        process.cwd(),
        user.avatar_url.replace(/^[\\/]/, ""),
      );
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err) {
        // ignore deletion errors
      }
    }

    // store new path
    updates.avatar_url = `/uploads/images/${file.filename}`;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
  return sanitizeUser(updated as any);
}

async function softDeleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { is_active: false, deleted_at: new Date() },
  });

  return sanitizeUser(updated as any);
}

type GetUsersOptions = {
  page?: number;
  limit?: number;
  search?: string | undefined;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

async function getUsers(options: GetUsersOptions) {
  const page = Number(options.page) > 0 ? Number(options.page) : 1;
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 10;
  const skip = (page - 1) * limit;
  const search =
    options.search && options.search.trim() !== "" ? options.search : undefined;

  const allowedSort: Record<string, any> = {
    created_at: { created_at: options.sortOrder || "desc" },
    updated_at: { updated_at: options.sortOrder || "desc" },
    name: { name: options.sortOrder || "desc" },
    email: { email: options.sortOrder || "desc" },
  };

  const sortByKey =
    options.sortBy && Object.keys(allowedSort).includes(options.sortBy)
      ? options.sortBy
      : "created_at";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: allowedSort[sortByKey],
    }),
  ]);

  return {
    meta: { total, page, limit },
    items: items.map((u) => sanitizeUser(u as any)),
  };
}

async function deactivateUserByAdmin(targetUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { is_active: false, deleted_at: new Date() },
  });

  return sanitizeUser(updated as any);
}

export const UserService = {
  updateProfile,
  softDeleteUser,
  getUsers,
  deactivateUserByAdmin,
};

export default UserService;
