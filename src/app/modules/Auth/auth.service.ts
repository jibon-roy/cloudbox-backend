import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import { prisma } from "../../../lib/prisma";
import { hashItem } from "../../../utils/hashAndCompareItem";
import { IUser } from "./auth.interface";
import { generateOTP } from "../../../utils/generateOtp";
import emailSender from "../../../helpers/email_sender/emailSender";
import { otpEmail } from "../../../shared/emails/otpEmail";
import { saveOtp } from "../../../lib/otpStore";
import { compareItem } from "../../../utils/hashAndCompareItem";
import { jwtHelpers } from "../../../utils/jwtHelpers";
import config from "../../../config";
import { randomUUID } from "crypto";
import {
  saveResetToken,
  consumeResetToken,
} from "../../../lib/passwordResetStore";
import resetPasswordEmail from "../../../shared/emails/resetPasswordEmail";
import { sanitizeUser } from "../../../shared/sanitizeUser";

const getMe = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: id,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  return sanitizeUser(user);
};

const createUser = async (userData: IUser) => {
  // If user already exists, handle accordingly
  const existing = await prisma.user.findUnique({
    where: { email: userData.email },
  });
  if (existing) {
    if (!existing.email_verified_at) {
      // resend verification OTP
      try {
        const otp = generateOTP();
        await saveOtp(existing.email, otp);
        const html = otpEmail(otp);
        await emailSender("Your verification code", existing.email, html);
      } catch (err) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to send verification email",
        );
      }

      return {
        needsVerification: true,
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          verified_at: null,
        },
        verification_sent_at: new Date().toISOString(),
      };
    }

    // Already exists and verified
    throw new ApiError(httpStatus.CONFLICT, "User already exists");
  }

  // Create new user
  const hashpassword = await hashItem(userData.password);

  const user = await prisma.user.create({
    data: {
      email: userData.email,
      name: userData.name,
      password: hashpassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Failed to create user");
  }

  // send verification OTP to user's email
  try {
    const otp = generateOTP();
    // persist otp with TTL (Redis)
    await saveOtp(user.email, otp);
    const html = otpEmail(otp);
    await emailSender("Your verification code", user.email, html);
    // Note: Redis is used to store the OTP with expiry.
  } catch (err) {
    // If email sending fails, surface a friendly error
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to send verification email",
    );
  }

  return {
    needsVerification: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      verified_at: null,
    },
    verification_sent_at: new Date().toISOString(),
  };
};

async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const token = randomUUID();
  const ttlMs = Number(process.env.RESET_PASSWORD_TTL_MS) || 60 * 60 * 1000; // default 1 hour

  if (user) {
    try {
      await saveResetToken(user.email, token, ttlMs);
      const frontendReset =
        process.env.FRONTEND_RESET_URL || process.env.FRONTEND_URL;
      const html = resetPasswordEmail(token, frontendReset);
      await emailSender("Password reset request", user.email, html);
      return { sent: true, verification_sent_at: new Date().toISOString() };
    } catch (err) {
      // do not reveal internal errors to caller
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to send reset email",
      );
    }
  }

  // Always return success to avoid user enumeration
  return { sent: true };
}

async function resetPassword(token: string, newPassword: string) {
  const email = await consumeResetToken(token);
  if (!email)
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired token");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  const hashed = await hashItem(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  return { success: true };
}

async function verifyOtpAndLogin(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  // set email_verified_at if not already
  if (!user.email_verified_at) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verified_at: new Date() },
    });
  }

  // ensure user is active
  if (user && user.is_active === false) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your CloudBox profile has been deactivate",
    );
  }

  const payload = { id: user.id, email: user.email };
  const accessExpires = process.env.ACCESS_EXPIRES_IN || "1d";
  const refreshExpires = process.env.REFRESH_EXPIRES_IN || "30d";
  const accessToken = jwtHelpers.generateToken(
    payload,
    process.env.JWT_SECRET as string,
    accessExpires as any,
  );

  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwtHelpers.generateToken(
    payload,
    refreshSecret as string,
    refreshExpires as any,
  );

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    access_expires_in: accessExpires,
    refresh_expires_in: refreshExpires,
  };
}

async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const isMatch = await compareItem(password, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  // If email not verified, send verification OTP and inform the caller
  if (!user.email_verified_at) {
    try {
      const otp = generateOTP();
      await saveOtp(user.email, otp);
      const html = otpEmail(otp);
      await emailSender("Your verification code", user.email, html);
    } catch (err) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to send verification email",
      );
    }

    return {
      needsVerification: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verified_at: null,
      },
      verification_sent_at: new Date().toISOString(),
    };
  }

  // ensure user is active
  if (user && user.is_active === false) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your CloudBox profile has been deactivate",
    );
  }

  const payload = { id: user!.id, email: user!.email };
  const accessExpires = process.env.ACCESS_EXPIRES_IN || "1d";
  const refreshExpires = process.env.REFRESH_EXPIRES_IN || "30d";
  const accessToken = jwtHelpers.generateToken(
    payload,
    process.env.JWT_SECRET as string,
    accessExpires as any,
  );

  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwtHelpers.generateToken(
    payload,
    refreshSecret as string,
    refreshExpires as any,
  );

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    access_expires_in: accessExpires,
    refresh_expires_in: refreshExpires,
  };
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const payload = jwtHelpers.verifyToken(
      refreshToken,
      secret as string,
    ) as any;
    if (!payload || !payload.id) throw new Error("Invalid token payload");

    const accessExpires = process.env.ACCESS_EXPIRES_IN || "1d";
    const newAccessToken = jwtHelpers.generateToken(
      { id: payload.id, email: payload.email },
      process.env.JWT_SECRET as string,
      accessExpires as any,
    );

    return { accessToken: newAccessToken, access_expires_in: accessExpires };
  } catch (err) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired refresh token",
    );
  }
}

async function googleLogin(idToken: string) {
  if (!idToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Missing id token");
  }

  // Verify token with Google's tokeninfo endpoint
  const resp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!resp.ok) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Google id token");
  }

  const info = await resp.json();

  // Verify audience
  const clientId = process.env.GOOGLE_CLIENT_ID || config.google?.clientId;
  if (!clientId || info.aud !== clientId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Google client id");
  }

  const email = info.email as string;
  const name = ((info.name as string) || email.split("@")[0]) as string;
  const email_verified =
    info.email_verified === "true" || info.email_verified === true;

  if (!email_verified) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Google account not verified");
  }

  // find or create user (store avatar_url from Google picture)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const randomPassword = randomUUID();
    const hashed = await hashItem(randomPassword);
    user = (await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashed,
        email_verified_at: new Date(),
        avatar_url: (info.picture as string) || "/assets/user_avatar.png",
      },
      select: {
        id: true,
        name: true,
        email: true,
        email_verified_at: true,
        avatar_url: true,
      },
    })) as any;
  } else {
    // update email_verified_at if not set and update avatar_url if provided by Google
    const updates: any = {};
    if (!user.email_verified_at) updates.email_verified_at = new Date();
    if (info.picture && user.avatar_url !== info.picture)
      updates.avatar_url = info.picture;

    if (Object.keys(updates).length > 0) {
      user = (await prisma.user.update({
        where: { id: user.id },
        data: updates,
      })) as any;
    }
  }
  // ensure user is active
  if (user && user.is_active === false) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your CloudBox profile has been deactivate",
    );
  }
  const payload = { id: user!.id, email: user!.email };
  const accessExpires = process.env.ACCESS_EXPIRES_IN || "1d";
  const refreshExpires = process.env.REFRESH_EXPIRES_IN || "30d";
  const accessToken = jwtHelpers.generateToken(
    payload,
    process.env.JWT_SECRET as string,
    accessExpires as any,
  );

  const refreshSecret =
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwtHelpers.generateToken(
    payload,
    refreshSecret as string,
    refreshExpires as any,
  );

  return {
    user: sanitizeUser(user as any),
    accessToken,
    refreshToken,
    access_expires_in: accessExpires,
    refresh_expires_in: refreshExpires,
  };
}

export const AuthService = {
  getMe,
  createUser,
  login,
  googleLogin,
  verifyOtpAndLogin,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
};
