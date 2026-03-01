import { z } from "zod";

const createUserZodSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.email("Invalid email address").min(1, "Email is required"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
  }),
});

const loginZodSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
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
