import { z } from "zod";

export const createSubscriptionZodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    price: z.number().nonnegative().optional(),
    max_folders: z.number().int().nonnegative().optional(),
    max_file_size_mb: z.number().int().nonnegative().optional(),
    max_storage_mb: z.number().int().nonnegative().optional(),
    max_nesting_level: z.number().int().nonnegative().optional(),
    total_file_limit: z.number().int().nonnegative().optional(),
    files_per_folder: z.number().int().nonnegative().optional(),
    trial_days: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateSubscriptionZodSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    price: z.number().nonnegative().optional(),
    max_folders: z.number().int().nonnegative().optional(),
    max_file_size_mb: z.number().int().nonnegative().optional(),
    max_storage_mb: z.number().int().nonnegative().optional(),
    max_nesting_level: z.number().int().nonnegative().optional(),
    total_file_limit: z.number().int().nonnegative().optional(),
    files_per_folder: z.number().int().nonnegative().optional(),
    trial_days: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const buySubscriptionZodSchema = z.object({
  body: z.object({
    months: z.number().int().min(1),
  }),
});

export const updateUserSubscriptionZodSchema = z.object({
  body: z.object({
    months: z.number().int().min(1),
  }),
});

export const SibscriptionValidation = {
  createSubscriptionZodSchema,
  updateSubscriptionZodSchema,
};

export default SibscriptionValidation;
