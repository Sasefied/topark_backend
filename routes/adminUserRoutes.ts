import { Router } from "express";
import {
  listTeamUsers,
  updateTeamMember,
  deactivateUser,
  deleteMember,
} from "../controllers/adminUserController";
import auth from "../middlewares/auth";

const router = Router();

router.get("/team-members", auth, listTeamUsers);
router.patch("/team-members/:teamMemberId", auth, updateTeamMember);
router.patch("/team-members/:teamMemberId/deactivate", auth, deactivateUser);
router.delete("/team-members/:teamMemberId/delete",auth, deleteMember);
export default router;
