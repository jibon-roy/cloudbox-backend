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

export const UserService = {
  updateProfile,
  softDeleteUser,
};

export default UserService;
