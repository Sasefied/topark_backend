import { Router } from "express";
import {
  listTeamUsers,
  updateTeamMember,
  deactivateUser,
} from "../controllers/adminUserController";
import auth from "../middlewares/auth";

const router = Router();

router.get("/team-members", auth, listTeamUsers);
router.patch("/team-members/:teamMemberId", auth, updateTeamMember);
router.patch("/team-members/:teamMemberId/deactivate", auth, deactivateUser);

export default router;
