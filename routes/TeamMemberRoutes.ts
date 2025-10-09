import { Router } from "express";
import {
  updateTeamMember,
  deactivateUser,
  deleteMember,
  searchTeamNames,
  listAllTeamMembers,
} from "../controllers/TeamMemberController";
import auth from "../middlewares/auth";
import { getAllTeamNames } from "../controllers/teamController";

const router = Router();

router.get("/team-members", auth, listAllTeamMembers);
router.get("/teams/search", auth, searchTeamNames);
router.get("/teamName", auth, getAllTeamNames);

router.patch("/team-members/:teamMemberId", auth, updateTeamMember);
router.patch("/team-members/:teamMemberId/deactivate", auth, deactivateUser);
router.delete("/team-members/:teamMemberId/",auth, deleteMember);
export default router;
