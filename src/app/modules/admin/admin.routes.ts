import express from 'express';
import auth from '../../middlewares/auth';
import { AdminController } from './admin.controller';

const router = express.Router();

// Stats endpoints: weekly, monthly, yearly
router.get('/traffic', auth('ADMIN'), AdminController.userTrafficStats);

// Summary endpoint: total users, transactions, subscribers, income
router.get('/summary', auth('ADMIN'), AdminController.adminSummary);

export const AdminRoutes = router;
