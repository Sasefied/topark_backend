// routes/teamRoutes.ts
import express from "express";
import {
  saveTeamName,
  updatePrimaryUsage,
  addTeamMembers,
  acceptInvitation,
} from "../controllers/teamController";
import { body } from "express-validator";
import auth from "../middlewares/auth";
import { validate } from "../middlewares/validate";

const router = express.Router();


// Step 1: Save team name (Team Onboarding)
router.post(
  "/onboarding/team-name",
  auth,
  body("teamName").notEmpty().withMessage("Team name is required"),
  validate,
  saveTeamName
);

// Step 2: Update primary usage
router.patch(
  "/onboarding/primary-usage",
  auth,
  body("primaryUsage")
    .isIn(["Only Buying", "Buying and Selling"])
    .withMessage("Must be Buying, Selling, or Buying and Selling"),
  validate,
  updatePrimaryUsage
);

// Step 3: Add team members
router.post(
  "/onboarding/team-members",
  auth,
  body("members")
    .notEmpty()
    .withMessage("Members list is required")
    .isArray()
    .withMessage("Members must be an array"),
  validate,
  addTeamMembers
);

// ✅ Step 4: Accept invitation (No auth needed, token-based)
router.post(
  "/onboarding/invite/accept",
  body("token").notEmpty().withMessage("Invitation token is required"),
  body("firstName").notEmpty(),
  body("lastName").notEmpty(),
  body("password").notEmpty(),
  validate,
  acceptInvitation
);





export default router;
