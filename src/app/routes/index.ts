import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.route";
import { SubscriptionRoutes } from "../modules/subscription/subscription.route";
import { BillingRoutes } from "../modules/billing/billing.route";
import { FileRoutes } from "../modules/file/file.route";
import { FolderRoutes } from "../modules/folder/folder.route";
import { FileSystemRoutes } from "../modules/file-system/file-system.route";
import { ShareRoutes } from "../modules/share/share.route";
import { StorageRoutes } from "../modules/storage/storage.route";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/user",
    route: UserRoutes,
  },
  {
    path: "/subscription",
    route: SubscriptionRoutes,
  },
  {
    path: "/billing",
    route: BillingRoutes,
  },
  {
    path: "/files",
    route: FileRoutes,
  },
  {
    path: "/folders",
    route: FolderRoutes,
  },
  {
    path: "/filesystem",
    route: FileSystemRoutes,
  },
  {
    path: "/share",
    route: ShareRoutes,
  },
  {
    path: "/storage",
    route: StorageRoutes,
  },
  //   {
  //     path: "/order",
  //     route: OrderRoutes,
  //   },
];

moduleRoutes.forEach((r) => router.use(r.path, r.route));

export default router;
