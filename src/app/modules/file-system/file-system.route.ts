import express from 'express';
import auth from '../../middlewares/auth';
import { FileSystemController } from './file-system.controller';

const router = express.Router();

router.get('/download/file/:id', auth('USER', 'ADMIN'), FileSystemController.downloadFileById);
router.get('/download/folder/:id', auth('USER', 'ADMIN'), FileSystemController.downloadFolderById);
router.get('/', auth('USER', 'ADMIN'), FileSystemController.getFileSystem);

export const FileSystemRoutes = router;
