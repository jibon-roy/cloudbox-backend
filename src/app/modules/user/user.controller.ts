import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { UserService } from "./user.service";
import httpStatus from "http-status";

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const data = req.body || {};
  const file = req.file as Express.Multer.File | undefined;

  const result = await UserService.updateProfile(
    user.id,
    { name: data.name },
    file,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Profile updated",
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await UserService.softDeleteUser(user.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User deleted",
    data: result,
  });
});

export const UserController = {
  updateProfile,
  deleteUser,
};

export default UserController;
