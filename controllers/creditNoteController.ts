import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import CreditNote from "../schemas/CreditNote";
import { responseHandler } from "../utils/responseHandler";

/**
 * Create credit notes
 *
 * @async
 * @param  {Request} req - Express request object
 * @param  {Response} res - Express response object
 * @route   POST /api/credit-notes
 * @access  Private
 * @returns {Promise<void>}
 */
const createCreditNote = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { orderId, clientId,startDate, endDate, total, } = req.body;

    await CreditNote.create({
      userId: req.userId,
      orderId,
      clientId,
      startDate,
      endDate,
      total
    });

    responseHandler(res, 200, "Credit notes created successfully", "success");
  }
);

export { createCreditNote };