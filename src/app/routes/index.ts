import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.route";

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
  //   {
  //     path: "/order",
  //     route: OrderRoutes,
  //   },
];

moduleRoutes.forEach((r) => router.use(r.path, r.route));

export default router;
