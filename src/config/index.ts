import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env"),
});

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT || 8000,
  password_salt: process.env.PASSWORD_SALT || "12",
  emailSender: {
    email: process.env.EMAIL_SENDER_EMAIL || "",
    app_pass: process.env.EMAIL_SENDER_APP_PASS || "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || "",
  },
  apiAccessToken: process.env.API_ACCESS_TOKEN || "",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: Number(process.env.RATE_LIMIT_MAX) || 120,
  },
};
