import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import httpStatus from 'http-status';

const getUsers = catchAsync(async (req: Request, res: Response) => {
  const q = req.query || {};
  const page = Number(q.page) || 1;
  const limit = Math.min(Number(q.limit) || 10, 100);
  const search = (q.search as string) || (q.q as string) || undefined;
  const sortBy = (q.sortBy as string) || 'created_at';
  const sortOrder = (q.sortOrder as string) === 'asc' ? 'asc' : 'desc';

  const result = await UserService.getUsers({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Users fetched',
    data: result,
  });
});

const deactivateUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id) return res.status(400).json({ success: false, message: 'Missing user id' });

  const result = await UserService.deactivateUserByAdmin(id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User deactivated',
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const data = req.body || {};
  const file = req.file as Express.Multer.File | undefined;

  const result = await UserService.updateProfile(user.id, { name: data.name }, file);

  // Convert relative avatar_url to full URL
  if (result && result.avatar_url && !result.avatar_url.startsWith('http')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    result.avatar_url = `${baseUrl}${result.avatar_url}`;
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Profile updated',
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const result = await UserService.softDeleteUser(user.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User deleted',
    data: result,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const result = await UserService.getCurrentUser(user.id);

  // Convert relative avatar_url to full URL
  if (result.user && result.user.avatar_url && !result.user.avatar_url.startsWith('http')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    result.user.avatar_url = `${baseUrl}${result.user.avatar_url}`;
  }

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'User information fetched',
    data: result,
  });
});

export const UserController = {
  updateProfile,
  deleteUser,
  getUsers,
  deactivateUser,
  getMe,
};

export default UserController;
