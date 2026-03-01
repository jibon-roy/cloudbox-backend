import { z } from "zod";

export const createFileShareSchema = z.object({
  body: z.object({
    sharedWithUserId: z.string().uuid().optional(),
    permission: z.enum(["VIEW", "EDIT"]).optional(),
    is_public: z.boolean().optional(),
    expires_at: z.string().optional(),
  }),
});

export const createFolderShareSchema = z.object({
  body: z.object({
    sharedWithUserId: z.string().uuid().optional(),
    permission: z.enum(["VIEW", "EDIT"]).optional(),
    is_public: z.boolean().optional(),
    expires_at: z.string().optional(),
  }),
});

export const getShareLinkSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ expires_at: z.string().optional() }).optional(),
});

export const shareUpdateSchema = z.object({
  body: z.object({ permission: z.enum(["VIEW", "EDIT"]).optional() }),
});

export const ShareValidation = {
  createFileShareSchema,
  createFolderShareSchema,
  getShareLinkSchema,
  shareUpdateSchema,
};

export default ShareValidation;
