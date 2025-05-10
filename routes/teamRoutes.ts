import express from "express";
import {
  saveTeamName,
  updatePrimaryUsage,
  addTeamMembers,
  acceptInvitation,
} from "../controllers/teamController";
import auth from "../middlewares/auth";

const router = express.Router();

// Step 1: Save team name (Team Onboarding)
router.post("/onboarding/team-name", auth, saveTeamName);

// Step 2: Update primary usage
router.patch("/onboarding/primary-usage", auth, updatePrimaryUsage);

// Step 3: Add team members
router.post("/onboarding/team-members", auth, addTeamMembers);

// ✅ Step 4: Accept invitation (No auth needed, token-based)
router.post("/onboarding/invite/accept", acceptInvitation);

export default router;
