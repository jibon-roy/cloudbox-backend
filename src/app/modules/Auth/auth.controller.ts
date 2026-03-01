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

  if (!user || !user.id) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
  }

  const result = await AuthService.getMe(user.id as string);

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

const forgotPassword = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email as string);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message:
        "If an account exists for this email, a password reset email was sent.",
      data: result,
    });
  },
);

const resetPassword = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;
    await AuthService.resetPassword(token, password);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Password has been reset successfully",
      data: { success: true },
    });
  },
);

const refreshToken = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshAccessToken(refreshToken);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Access token refreshed",
      data: result,
    });
  },
);

const login = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const result = await AuthService.login(email, password);

  // If login requires email verification, inform the client
  if ((result as any)?.needsVerification) {
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Verification email sent successfully. Please check your email.",
      data: result,
    });
    return;
  }

  // set auth cookies (httpOnly)
  try {
    const accessToken = (result as any).accessToken;
    const refreshToken = (result as any).refreshToken;
    if (accessToken && refreshToken) {
      const secure = config.env === "production";
      const accessMax =
        Number(process.env.ACCESS_COOKIE_MAX_AGE_MS) || 24 * 60 * 60 * 1000; // 1 day
      const refreshMax =
        Number(process.env.REFRESH_COOKIE_MAX_AGE_MS) ||
        30 * 24 * 60 * 60 * 1000; // 30 days
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: accessMax,
        path: "/",
      });
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: refreshMax,
        path: "/",
      });
    }
  } catch (err) {
    // ignore cookie set failures
  }

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
      // set cookies before redirect
      try {
        const accessToken = (result as any).accessToken;
        const refreshToken = (result as any).refreshToken;
        const secure = config.env === "production";
        const accessMax =
          Number(process.env.ACCESS_COOKIE_MAX_AGE_MS) || 24 * 60 * 60 * 1000;
        const refreshMax =
          Number(process.env.REFRESH_COOKIE_MAX_AGE_MS) ||
          30 * 24 * 60 * 60 * 1000;
        if (accessToken && refreshToken) {
          res.cookie("access_token", accessToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            maxAge: accessMax,
            path: "/",
          });
          res.cookie("refresh_token", refreshToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            maxAge: refreshMax,
            path: "/",
          });
        }
      } catch (err) {
        // ignore
      }
      const redirectUrl = `${callback}${sep}token=${encodeURIComponent((result as any).accessToken)}`;
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

const verifyOtpController = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { email, otp } = req.body;
    // verify from otp store (redis)
    const ok = await verifyOtp(email, otp);
    if (!ok) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired OTP");
    }

    // mark user's email as verified and return token
    const result = await AuthService.verifyOtpAndLogin(email);

    // set cookies for tokens if present
    try {
      const accessToken = (result as any).accessToken;
      const refreshToken = (result as any).refreshToken;
      const secure = config.env === "production";
      const accessMax =
        Number(process.env.ACCESS_COOKIE_MAX_AGE_MS) || 24 * 60 * 60 * 1000;
      const refreshMax =
        Number(process.env.REFRESH_COOKIE_MAX_AGE_MS) ||
        30 * 24 * 60 * 60 * 1000;
      if (accessToken && refreshToken) {
        res.cookie("access_token", accessToken, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          maxAge: accessMax,
          path: "/",
        });
        res.cookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          maxAge: refreshMax,
          path: "/",
        });
      }
    } catch (err) {
      // ignore cookie failures
    }

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "OTP verified",
      data: result,
    });
  },
);

export const AuthController = {
  getMe,
  createUser,
  forgotPassword,
  resetPassword,
  login,
  googleLogin,
  verifyOtpController,
  refreshToken,
};
