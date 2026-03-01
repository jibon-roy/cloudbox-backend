import { z } from "zod";

export const createSubscriptionZodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    price: z.number().positive().optional(),
    max_folders: z.number().int().nonnegative().optional(),
    max_file_size_mb: z.number().int().nonnegative().optional(),
    max_storage_mb: z.number().int().nonnegative().optional(),
    trial_days: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateSubscriptionZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    max_folders: z.number().int().nonnegative().optional(),
    max_file_size_mb: z.number().int().nonnegative().optional(),
    max_storage_mb: z.number().int().nonnegative().optional(),
    trial_days: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const SibscriptionValidation = {
  createSubscriptionZodSchema,
  updateSubscriptionZodSchema,
};

export default SibscriptionValidation;
