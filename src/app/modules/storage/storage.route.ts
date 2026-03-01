import express from "express";
import auth from "../../middlewares/auth";
import { StorageController } from "./storage.controller";

const router = express.Router();

// User: get own storage usage
router.get("/me", auth("USER", "ADMIN"), StorageController.getMyStorage);

// Admin: aggregate storage across users
router.get("/", auth("ADMIN"), StorageController.getAllStorage);

export const StorageRoutes = router;
