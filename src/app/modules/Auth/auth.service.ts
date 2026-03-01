import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import { prisma } from "../../../lib/prisma";
import { hashItem } from "../../../utils/hashAndCompareItem";
import { IUser } from "./auth.interface";
import { compareItem } from "../../../utils/hashAndCompareItem";
import { jwtHelpers } from "../../../utils/jwtHelpers";
import config from "../../../config";
import { randomUUID } from "crypto";

const getMe = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: id,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  return user;
};

const createUser = async (userData: IUser) => {
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

  return user;
};

export const AuthService = {
  getMe,
  createUser,
  login,
  googleLogin,
};

async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const isMatch = await compareItem(password, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const payload = { id: user!.id, email: user!.email };
  const accessToken = jwtHelpers.generateToken(
    payload,
    process.env.JWT_SECRET as string,
    (process.env.EXPIRES_IN || "2h") as any,
  );

  return {
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
    },
    accessToken,
  };
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
        avatar_url: (info.picture as string) || null,
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
  const payload = { id: user!.id, email: user!.email };
  const accessToken = jwtHelpers.generateToken(
    payload,
    process.env.JWT_SECRET as string,
    (process.env.EXPIRES_IN || "2h") as any,
  );

  return {
    user: {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      avatar_url: user!.avatar_url || null,
    },
    accessToken,
  };
}
