import express from 'express';
import auth from '../../middlewares/auth';
import { UserController } from './user.controller';
import { RequestValidation } from '../../middlewares/validateRequest';
import { UserValidation } from './user.validation';
import { imageUploader } from '../../../helpers/file_uploader/imageUploader';

const router = express.Router();
// Get current logged-in user information
router.get('/me', auth('USER', 'ADMIN'), UserController.getMe);
// Update profile (multipart/form-data with optional 'avatar' file)
router.put(
  '/profile',
  auth('USER', 'ADMIN'),
  imageUploader.single('avatar'),
  RequestValidation.validateRequest(UserValidation.updateProfileZodSchema),
  UserController.updateProfile
);

// Soft delete current user
router.delete('/delete', auth('USER'), UserController.deleteUser);

// Admin: list users with pagination, search and sort
router.get('/', auth('ADMIN'), UserController.getUsers);

// Admin: deactivate a user (by id)
router.patch('/deactivate/:id', auth('ADMIN'), UserController.deactivateUser);

export const UserRoutes = router;
