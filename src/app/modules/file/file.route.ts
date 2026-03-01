import express from "express";
import auth from "../../middlewares/auth";
import { FileController } from "./file.controller";
import { upload } from "../../../helpers/file_uploader/fileUploadToLocal";

const router = express.Router();

// Accept multiple files on the `files` field (max 20 per request)
router.post(
  "/",
  auth("USER", "ADMIN"),
  upload.array("files", 20),
  FileController.uploadFile,
);
router.put("/:id", auth("USER", "ADMIN"), FileController.replaceFile);
router.delete("/:id", auth("USER", "ADMIN"), FileController.deleteFile);
router.get("/", auth("USER", "ADMIN"), FileController.listFiles);
router.get("/:id", auth("USER", "ADMIN"), FileController.getFile);
router.patch("/:id/move", auth("USER", "ADMIN"), FileController.moveFile);
router.post("/:id/copy", auth("USER", "ADMIN"), FileController.copyFile);

export const FileRoutes = router;
