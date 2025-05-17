// controllers/orgController.ts
import { RequestHandler } from "express";
import { Organization } from "../schemas/Organization";
import { Connection } from "../schemas/Connection";

/**
 * @swagger
 * /api/org/orgs:
 *   get:
 *     summary: List all organizations
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all organizations
 */
export const listOrgs: RequestHandler = async (req, res, next) => {
  try {
    const orgs = await Organization.find();
    res.json(orgs);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/org/orgs/{orgId}:
 *   get:
 *     summary: Get details of a specific organization
 *     tags: [Organization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization details
 *       404:
 *         description: Organization not found
 */
export const getOrg: RequestHandler = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);
    if (!org) {
      res.status(404).json({ message: "Organization not found" });
      return;
    }
    res.json(org);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/org/connections/{targetOrgId}/request:
 *   post:
 *     summary: Send a trade request to another organization
 *     tags: [Connection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetOrgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Trade request sent
 */
export const sendRequest: RequestHandler = async (req, res, next) => {
  try {
    const fromOrg = req.user!.orgId;
    const { targetOrgId } = req.params;
    const connection = await Connection.create({ fromOrg, toOrg: targetOrgId });
    res.status(201).json(connection);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/org/connections:
 *   get:
 *     summary: List all incoming and outgoing connections
 *     tags: [Connection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of connections
 */
export const listConnections: RequestHandler = async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const conns = await Connection.find({
      $or: [{ fromOrg: orgId }, { toOrg: orgId }],
    });
    res.json(conns);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/org/connections/{connectionId}/accept:
 *   patch:
 *     summary: Accept a pending trade connection
 *     tags: [Connection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection accepted
 *       404:
 *         description: Not found or not authorized
 */
export const acceptConnection: RequestHandler = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const orgId = req.user!.orgId;
    const conn = await Connection.findOneAndUpdate(
      { _id: connectionId, toOrg: orgId, status: "pending" },
      { status: "accepted" },
      { new: true }
    );
    if (!conn) {
      res.status(404).json({ message: "Not found or not authorized" });
      return;
    }
    res.json(conn);
  } catch (err) {
    next(err);
  }
};

/**
 * @swagger
 * /api/org/connections/{connectionId}/reject:
 *   patch:
 *     summary: Reject a pending trade connection
 *     tags: [Connection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection rejected
 *       404:
 *         description: Not found or not authorized
 */
export const rejectConnection: RequestHandler = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const orgId = req.user!.orgId;
    const conn = await Connection.findOneAndUpdate(
      { _id: connectionId, toOrg: orgId, status: "pending" },
      { status: "rejected" },
      { new: true }
    );
    if (!conn) {
      res.status(404).json({ message: "Not found or not authorized" });
      return;
    }
    res.json(conn);
  } catch (err) {
    next(err);
  }
};
