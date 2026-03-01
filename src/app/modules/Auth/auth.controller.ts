import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AuthService } from "./auth.service";
import { verifyOtp } from "../../../lib/otpStore";
import ApiError from "../../../errors/apiError";
import config from "../../../config";

const getMe = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const user = req.user;

  const result = await AuthService.getMe(user?.id as string);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User retrieved successfully",
    data: result,
  });
});

const createUser = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const userData = req.body;

    const result = await AuthService.createUser(userData);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.CREATED,
      message: "Verification email sent successfully. Please check your email.",
      data: result,
    });
  },
);

const login = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const result = await AuthService.login(email, password);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Login successful",
    data: result,
  });
});

const googleLogin = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { idToken } = req.body;

    const result = await AuthService.googleLogin(idToken);

    const callback =
      process.env.GOOGLE_CALLBACK_URL || config.google?.callbackUrl;
    if (callback) {
      const sep = callback.includes("?") ? "&" : "?";
      const redirectUrl = `${callback}${sep}token=${encodeURIComponent(result.accessToken)}`;
      return res.redirect(302, redirectUrl);
    }

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Login with Google successful",
      data: result,
    });
  },
);

export const AuthController = {
  getMe,
  createUser,
  login,
  googleLogin,
  verifyOtp: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, otp } = req.body;
    // verify from otp store (redis)
    const ok = await verifyOtp(email, otp);
    if (!ok) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired OTP");
    }

    // mark user's email as verified and return token
    const result = await AuthService.verifyOtpAndLogin(email);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "OTP verified",
      data: result,
    });
  }),
};
