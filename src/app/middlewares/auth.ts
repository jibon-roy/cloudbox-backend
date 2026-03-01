import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import { prisma } from "../../lib/prisma";
import { jwtHelpers } from "../../utils/jwtHelpers";
import ApiError from "../../errors/apiError";

// Express middleware: auth('ADMIN', 'USER')
const auth = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Accept Authorization header (Bearer) or cookie 'access_token'
      const authHeader = req.get("authorization");
      let token: string | undefined;
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.slice(7).trim();
      } else if (req.cookies && req.cookies.access_token) {
        token = req.cookies.access_token;
      }

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      const secret = process.env.JWT_SECRET as string;
      const verified = jwtHelpers.verifyToken(token, secret) as any;
      if (!verified || !verified.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
      }

      const user = await prisma.user.findUnique({ where: { id: verified.id } });
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "This user is not found !");
      }

      // Check active flag (use is_active field)
      if (user.is_active === false) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Your account is inactive. Please contact support.",
        );
      }

      if (roles.length && !roles.includes(user.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden!");
      }

      // attach user to request for downstream handlers
      (req as any).user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

export default auth;
