import express from "express";
import auth from "../../middlewares/auth";
import { RequestValidation } from "../../middlewares/validateRequest";
import { SibscriptionValidation } from "./sibscription.validation";
import { SubscriptionController } from "./subscription.controller";

const router = express.Router();

// Admin: create subscription package
router.post(
  "/",
  auth("ADMIN"),
  RequestValidation.validateRequest(
    SibscriptionValidation.createSubscriptionZodSchema,
  ),
  SubscriptionController.createPackage,
);

// Public: get all subscription packages
router.get("/", SubscriptionController.getAllPackages);

// Admin: get all packages (active + inactive)
router.get("/all", auth("ADMIN"), SubscriptionController.getAllPackagesAdmin);

// Buy subscription (redirect URL from Stripe)
router.post(
  "/buy/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(
    SibscriptionValidation.updateSubscriptionZodSchema,
  ),
  SubscriptionController.buySubscription,
);

// Update user's subscription (redirect URL from Stripe)
router.post(
  "/update/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(
    SibscriptionValidation.updateSubscriptionZodSchema,
  ),
  SubscriptionController.updateUserSubscription,
);

// Get current user's active subscription
router.get(
  "/me",
  auth("USER", "ADMIN"),
  SubscriptionController.getUserActiveSubscription,
);

// Admin: update subscription package
router.patch(
  "/:id",
  auth("ADMIN"),
  RequestValidation.validateRequest(
    SibscriptionValidation.updateSubscriptionZodSchema,
  ),
  SubscriptionController.updatePackage,
);

// Cancel user's active subscription
router.post(
  "/cancel",
  auth("USER", "ADMIN"),
  SubscriptionController.cancelSubscription,
);

// Admin: delete (soft) subscription package
router.delete("/:id", auth("ADMIN"), SubscriptionController.deletePackage);

export const SubscriptionRoutes = router;
