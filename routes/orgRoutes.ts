// routes/orgRoutes.ts
import { Router } from "express";
import { param } from "express-validator";
import { authGuard } from "../middlewares/authGuard";
import { validate } from "../middlewares/validate";
import {
  listOrgs,
  getOrg,
  sendRequest,
  listConnections,
  acceptConnection,
  rejectConnection,
} from "../controllers/orgController";

const router = Router();

// /api/org/orgs
router.get("/orgs", authGuard, listOrgs);

router.get(
  "/orgs/:orgId",
  authGuard,
  param("orgId")
    .notEmpty()
    .withMessage("orgId is required")
    .isMongoId()
    .withMessage("orgId must be a valid ObjectId"),
  validate,
  getOrg
);

// /api/org/connections
router.post(
  "/connections/:targetOrgId/request",
  authGuard,
  param("targetOrgId")
    .notEmpty()
    .withMessage("targetOrgId is required")
    .isMongoId()
    .withMessage("targetOrgId must be a valid ObjectId"),
  validate,
  sendRequest
);

router.get("/connections", authGuard, listConnections);

router.patch(
  "/connections/:connectionId/accept",
  authGuard,
  param("connectionId")
    .notEmpty()
    .withMessage("connectionId is required")
    .isMongoId()
    .withMessage("connectionId must be a valid ObjectId"),
  validate,
  acceptConnection
);

router.patch(
  "/connections/:connectionId/reject",
  authGuard,
  param("connectionId")
    .notEmpty()
    .withMessage("connectionId is required")
    .isMongoId()
    .withMessage("connectionId must be a valid ObjectId"),
  validate,
  rejectConnection
);

export default router;
