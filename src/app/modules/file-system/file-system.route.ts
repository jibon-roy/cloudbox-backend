import express from "express";
import auth from "../../middlewares/auth";
import { FileSystemController } from "./file-system.controller";

const router = express.Router();

router.get("/", auth("USER", "ADMIN"), FileSystemController.getFileSystem);

export const FileSystemRoutes = router;
