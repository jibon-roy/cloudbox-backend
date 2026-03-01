import express from "express";
import auth from "../../middlewares/auth";
import { ShareController } from "./share.controller";
import { RequestValidation } from "../../middlewares/validateRequest";
import { ShareValidation } from "./share.validation";

const router = express.Router();

// Create a share for a file (private user-to-user or public)
router.post(
  "/file/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.createFileShareSchema),
  ShareController.createFileShare,
);

// Get or create public share link for a file
router.get(
  "/link/file/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.getShareLinkSchema),
  ShareController.getShareLinkFile,
);

// Create a share for a folder
router.post(
  "/folder/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.createFolderShareSchema),
  ShareController.createFolderShare,
);

// Get or create public share link for a folder
router.get(
  "/link/folder/:id",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.getShareLinkSchema),
  ShareController.getShareLinkFolder,
);

// Public access via token (no auth)
router.get("/public/:token", ShareController.getPublic);

// File share management
router.get(
  "/file/:shareId",
  auth("USER", "ADMIN"),
  ShareController.getFileShare,
);
router.patch(
  "/file/:shareId",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.shareUpdateSchema),
  ShareController.updateFileShare,
);
router.delete(
  "/file/:shareId",
  auth("USER", "ADMIN"),
  ShareController.deleteFileShare,
);

// Folder share management
router.get(
  "/folder/:shareId",
  auth("USER", "ADMIN"),
  ShareController.getFolderShare,
);
router.patch(
  "/folder/:shareId",
  auth("USER", "ADMIN"),
  RequestValidation.validateRequest(ShareValidation.shareUpdateSchema),
  ShareController.updateFolderShare,
);
router.delete(
  "/folder/:shareId",
  auth("USER", "ADMIN"),
  ShareController.deleteFolderShare,
);

export const ShareRoutes = router;
