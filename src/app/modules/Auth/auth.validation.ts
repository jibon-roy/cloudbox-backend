import { z } from "zod";

const createUserZodSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    email: z
      .email("Invalid email address")
      .min(1, "Email is required")
      .max(100),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters long")
      .max(100),
  }),
});

const loginZodSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address").max(100),
    password: z.string().min(1, "Password is required").max(100),
  }),
});

const googleLoginZodSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, "idToken is required"),
  }),
});

export const AuthValidation = {
  createUserZodSchema,
  loginZodSchema,
  googleLoginZodSchema,
};
