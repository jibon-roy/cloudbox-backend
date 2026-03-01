import express from "express";
import auth from "../../middlewares/auth";
import { BillingController } from "./billing.controller";

const router = express.Router();

// Admin: get all billings (with basic user info) and date filter
router.get("/", auth("ADMIN"), BillingController.getAllBillings);

// My billings (current user)
router.get("/my", auth("USER", "ADMIN"), BillingController.getUserBillings);

// Admin: change billing status
router.patch(
  "/:id/status",
  auth("ADMIN"),
  BillingController.changeBillingStatus,
);

// Public: confirm payment by reference (e.g., after frontend redirect)
router.post("/confirm/:reference", BillingController.confirmPaymentByReference);

// Admin: get all active subscriptions
router.get(
  "/subscriptions/active",
  auth("ADMIN"),
  BillingController.getAllActiveSubscriptions,
);

// Admin: change subscription active status
router.patch(
  "/subscriptions/:id/status",
  auth("ADMIN"),
  BillingController.changeSubscriptionStatus,
);

export const BillingRoutes = router;
