import express from "express";
import auth from "../../middlewares/auth";
import { FolderController } from "./folder.controller";

const router = express.Router();

router.post("/", auth("USER", "ADMIN"), FolderController.createFolder);
router.get("/", auth("USER", "ADMIN"), FolderController.listFolders);
router.get("/:id", auth("USER", "ADMIN"), FolderController.getFolder);
router.delete("/:id", auth("USER", "ADMIN"), FolderController.deleteFolder);
router.patch("/:id/move", auth("USER", "ADMIN"), FolderController.moveFolder);
router.post("/:id/copy", auth("USER", "ADMIN"), FolderController.copyFolder);

export const FolderRoutes = router;
