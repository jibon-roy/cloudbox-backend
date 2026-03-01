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

router.get("/me", auth("USER"), AuthController.getMe);

router.post(
  "/login",
  RequestValidation.validateRequest(AuthValidation.loginZodSchema),
  AuthController.login,
);

router.post(
  "/google",
  RequestValidation.validateRequest(AuthValidation.googleLoginZodSchema),
  AuthController.googleLogin,
);

router.post(
  "/verify-otp",
  RequestValidation.validateRequest(AuthValidation.verifyOtpZodSchema),
  AuthController.verifyOtp,
);

export const AuthRoutes = router;
