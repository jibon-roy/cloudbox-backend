import { z } from "zod";

const updateProfileZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
  }),
});

export const UserValidation = {
  updateProfileZodSchema,
};

export default UserValidation;
