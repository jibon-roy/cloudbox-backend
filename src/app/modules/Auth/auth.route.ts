import express, { Request, Response } from "express";
import auth from "../../middlewares/auth";
import { AuthController } from "./auth.controller";

import { RequestValidation } from "../../middlewares/validateRequest";
import { AuthValidation } from "./auth.validation";

const router = express.Router();

router.post(
  "/register",
  RequestValidation.validateRequest(AuthValidation.createUserZodSchema),
  AuthController.createUser,
);

router.get("/me", auth("USER", "ADMIN"), AuthController.getMe);

router.post(
  "/login",
  RequestValidation.validateRequest(AuthValidation.loginZodSchema),
  AuthController.login,
);

// start Google OAuth2 authorization (redirect)
router.get("/google", AuthController.googleRedirect);

// OAuth2 callback
router.get("/google/callback", AuthController.googleCallback);

router.post(
  "/forgot-password",
  RequestValidation.validateRequest(AuthValidation.forgotPasswordZodSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  RequestValidation.validateRequest(AuthValidation.resetPasswordZodSchema),
  AuthController.resetPassword,
);

router.post(
  "/refresh-token",
  RequestValidation.validateRequest(AuthValidation.refreshTokenZodSchema),
  AuthController.refreshToken,
);

router.post(
  "/verify-otp",
  RequestValidation.validateRequest(AuthValidation.verifyOtpZodSchema),
  AuthController.verifyOtpController,
);

export const AuthRoutes = router;
