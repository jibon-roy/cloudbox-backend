import express from 'express';
import auth from '../../middlewares/auth';
import { AdminController } from './admin.controller';

const router = express.Router();

// Stats endpoints: weekly, monthly, yearly
router.get('/traffic', auth('ADMIN'), AdminController.userTrafficStats);

// User traffic by period (weekly, monthly, yearly) for chart/graph display
router.get('/user-traffic', auth('ADMIN'), AdminController.userTrafficByPeriod);

// Summary endpoint: total users, transactions, subscribers, income
router.get('/summary', auth('ADMIN'), AdminController.adminSummary);

// Contact form submission (public endpoint)
router.post('/contact', AdminController.submitContactForm);

export const AdminRoutes = router;
