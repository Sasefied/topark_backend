import { Request, Response } from "express";
import Inventory from "../schemas/Inventory";
import { responseHandler } from "../utils/responseHandler";
import { Types } from "mongoose";
import Order, { IOrder } from "../schemas/Order";
import OrderItem, { IOrderItem } from "../schemas/OrderItem";
import CartItem, { ICartItem } from "../schemas/CartItem";
import Cart from "../schemas/Cart";
import { NotFoundError } from "../utils/errors";
export interface IOrderWithItems extends IOrder, IOrderItem {}
interface AuthRequest extends Request {
  userId?: string;
}

const createBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(
        res,
        401,
        `Unauthorized: Invalid userId: ${req.userId}`,
        "error"
      );
    }
    const { inventoryId, quantity, price, deliveryDate, extraCostPrice } = req.body;

    if (!inventoryId || !Types.ObjectId.isValid(inventoryId)) {
      return responseHandler(
        res,
        400,
        `Invalid inventoryId: ${inventoryId}`,
        "error"
      );
    }
    if (isNaN(quantity) || quantity <= 0) {
      return responseHandler(
        res,
        400,
        "Quantity must be a positive number",
        "error"
      );
    }
    if (isNaN(price) || price < 0) {
      return responseHandler(res, 400, "Price cannot be negative", "error");
    }
    if (!isValidDate(deliveryDate)) {
      return responseHandler(res, 400, "Invalid delivery date", "error");
    }

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return responseHandler(
        res,
        404,
        `Inventory with ID ${inventoryId} not found`,
        "error"
      );
    }

    const cart = await Cart.findOneAndUpdate(
      { userId: req.userId },
      { $setOnInsert: { userId: req.userId } },
      { upsert: true, new: true }
    );

    const cartItem = await CartItem.findOneAndUpdate(
      { cartId: cart._id, inventoryId },
      {
        $setOnInsert: {
          cartId: cart._id,
          inventoryId,
          quantity,
          price,
          extraCostPrice,
          deliveryDate,
        },
      },
      { new: true, upsert: true }
    );

    responseHandler(
      res,
      201,
      "Buy order created successfully",
      "success",
      cartItem
    );
  } catch (error: any) {
    console.error("Error creating buy order:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};

const isValidDate = (date: string): boolean => {
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
};

const createBulkBuyOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { orders, teamId } = req.body;
    const userId = req.userId;

    console.log("teamID", teamId)

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return responseHandler(
        res,
        401,
        "Unauthorized: Invalid user ID",
        "error"
      );
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return responseHandler(
        res,
        400,
        "Orders array is required and cannot be empty",
        "error"
      );
    }

    const session = await Order.startSession();
    session.startTransaction();

    try {
     
      const createdOrders = [];
      for (const order of orders) {
        const {
          productName,
          supplierName,
          size,
          color,
          quantity,
          price,
          extraCostPrice,
          ccy,
          deliveryDate,
          inventoryId,
          productId,
          clientId,
          orderStatus,
        } = order;
        console.log("Order", order);

        // Validate required fields
        if (
          !productName ||
          !supplierName ||
          !inventoryId ||
          !productId ||
          !quantity ||
          !price
        ) {
          await session.abortTransaction();
          return responseHandler(
            res,
            400,
            "Missing required order fields",
            "error"
          );
        }
        if (quantity <= 0) {
          await session.abortTransaction();
          return responseHandler(
            res,
            400,
            "Quantity must be greater than 0",
            "error"
          );
        }
        if (price < 0) {
          await session.abortTransaction();
          return responseHandler(res, 400, "Price cannot be negative", "error");
        }
        if (deliveryDate && isNaN(new Date(deliveryDate).getTime())) {
          await session.abortTransaction();
          return responseHandler(
            res,
            400,
            `Invalid delivery date: ${deliveryDate}`,
            "error"
          );
        }
        if (
          !Types.ObjectId.isValid(inventoryId) ||
          !Types.ObjectId.isValid(productId)
        ) {
          await session.abortTransaction();
          return responseHandler(
            res,
            400,
            "Invalid inventoryId or productId",
            "error"
          );
        }
        if (clientId && !Types.ObjectId.isValid(clientId)) {
          await session.abortTransaction();
          return responseHandler(
            res,
            400,
            `Invalid clientId: ${clientId}`,
            "error"
          );
        }

        const newOrder = new Order({
          userId: new Types.ObjectId(userId),
          clientId: clientId ? new Types.ObjectId(clientId) : null,
          teamId: new Types.ObjectId(teamId),
          total: quantity * price,
          outstandingTotal: quantity * price,
          orderStatus: orderStatus || "Requested",
          invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });

        const savedOrder = await newOrder.save({ session });

        const newOrderItem = new OrderItem({
          orderId: savedOrder._id,
          inventoryId: new Types.ObjectId(inventoryId),
          quantity,
          price,
          extraCostPrice,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          productName,
          supplierName,
          size,
          color,
          ccy: ccy || "GBP",
          productId: new Types.ObjectId(productId),
          outstandingPrice: quantity * price,
        });
        await newOrderItem.save({ session });

        createdOrders.push({
          _id: savedOrder._id,
          productName,
          supplierName,
          size,
          color,
          quantity,
          price,
          extraCostPrice,
          ccy: ccy || "GBP",
          deliveryDate: newOrderItem.deliveryDate,
          inventoryId,
          productId,
          clientId: clientId || "",
          orderStatus: savedOrder.orderStatus,
          total: savedOrder.total,
        });
      }

      await session.commitTransaction();
      responseHandler(
        res,
        201,
        "Orders created successfully",
        "success",
        createdOrders
      );
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    await sessionStorage.abortTransaction();
    console.error("Error creating bulk buy orders:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};

const getAllBuyOrders = async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 10, status, search = "" } = req.query;

  try {
    const orderAggregate = Order.aggregate([
      // Match userId first
      {
        $match: {
          userId: new Types.ObjectId(req.userId),
          ...(status && { orderStatus: status }),
        },
      },
      // Lookup order items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true },
      },
      // Lookup inventory
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true },
      },
      // Lookup client details
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      // Lookup admin products
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $unwind: { path: "$adminProducts", preserveNullAndEmptyArrays: true },
      },
      // Apply search filter on adminProducts.productName
      {
        $match: {
          ...(search && {
            $or: [
              {
                "adminProducts.productName": { $regex: search, $options: "i" },
              },
              { "clientDetails.clientName": { $regex: search, $options: "i" } },
            ],
          }),
        },
      },
      // Set client details
      {
        $set: {
          clientId: "$clientId",
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: { clientName: "Unknown Supplier" },
              else: "$clientDetails",
            },
          },
        },
      },
    ]);
    const buyOrders = await (Order as any).aggregatePaginate(orderAggregate, {
      page: Number(page),
      limit: Number(limit),
      customLabels: {
        docs: "orders",
        totalDocs: "totalOrders",
      },
    });

    console.log("Buy Orders Response:", JSON.stringify(buyOrders, null, 2));

    responseHandler(
      res,
      200,
      "Buy orders fetched successfully",
      "success",
      buyOrders
    );
  } catch (error: any) {
    console.error("Error fetching buy orders:", {
      message: error.message,
      stack: error.stack,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Failed to fetch buy orders",
      "error"
    );
  }
};

const deleteBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  try {
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    await CartItem.deleteOne({ cartId: cart._id, buyOrderId: id });

    responseHandler(res, 200, "Buy order deleted successfully", "success");
  } catch (error: any) {
    console.error("Error deleting buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};

const updateBuyOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { buyOrderId } = req.params;
    const { quantity, deliveryDate, price, orderStatus } = req.body;

    if (!req.userId || !Types.ObjectId.isValid(req.userId)) {
      return responseHandler(
        res,
        401,
        `Unauthorized: Invalid userId: ${req.userId}`,
        "error"
      );
    }

    if (!Types.ObjectId.isValid(buyOrderId)) {
      return responseHandler(
        res,
        400,
        `Invalid buyOrderId: ${buyOrderId}`,
        "error"
      );
    }

    if (
      quantity !== undefined &&
      (typeof quantity !== "number" || quantity <= 0)
    ) {
      return responseHandler(
        res,
        400,
        `Invalid quantity: ${quantity}`,
        "error"
      );
    }
    if (deliveryDate && !isValidDate(deliveryDate)) {
      return responseHandler(
        res,
        400,
        `Invalid deliveryDate: ${deliveryDate}`,
        "error"
      );
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return responseHandler(res, 400, `Invalid price: ${price}`, "error");
    }
    if (
      orderStatus &&
      !["Pending", "Confirmed", "Delivered"].includes(orderStatus)
    ) {
      return responseHandler(
        res,
        400,
        `Invalid orderStatus: ${orderStatus}`,
        "error"
      );
    }

    // Check if the buyOrderId corresponds to a CartItem
    const cart = await Cart.findOne({ userId: new Types.ObjectId(req.userId) });
    if (cart) {
      const cartItem = await CartItem.findOne({
        _id: new Types.ObjectId(buyOrderId),
        cartId: cart._id,
      });

      if (cartItem) {
        // Update CartItem
        const cartItemUpdates: Partial<ICartItem> = {};
        if (quantity !== undefined) cartItemUpdates.quantity = quantity;
        if (price !== undefined) cartItemUpdates.price = price;
        if (deliveryDate !== undefined)
          cartItemUpdates.deliveryDate = new Date(deliveryDate);

        const updatedCartItem = await CartItem.findOneAndUpdate(
          { _id: new Types.ObjectId(buyOrderId), cartId: cart._id },
          { $set: cartItemUpdates },
          { new: true }
        );

        if (updatedCartItem) {
          responseHandler(
            res,
            200,
            "Cart item updated successfully",
            "success",
            {
              _id: updatedCartItem._id,
              quantity: updatedCartItem.quantity,
              price: updatedCartItem.price,
              deliveryDate: updatedCartItem.deliveryDate,
            }
          );
          return;
        }
      }
    }

    // If not a CartItem, try updating an Order/OrderItem
    const buyOrder = await Order.findOne({
      _id: new Types.ObjectId(buyOrderId),
      $or: [
        { userId: new Types.ObjectId(req.userId) },
        { clientId: new Types.ObjectId(req.userId) },
      ],
    });

    if (!buyOrder) {
      return responseHandler(
        res,
        404,
        "Buy order not found or not authorized",
        "error"
      );
    }

    const orderItem = await OrderItem.findOne({
      orderId: new Types.ObjectId(buyOrderId),
    });

    if (!orderItem) {
      return responseHandler(
        res,
        404,
        "OrderItem not found for this buy order",
        "error"
      );
    }

    // Update OrderItem
    const orderItemUpdates: Partial<IOrderItem> = {};
    if (quantity !== undefined) orderItemUpdates.quantity = quantity;
    if (price !== undefined) orderItemUpdates.price = price;
    if (deliveryDate !== undefined)
      orderItemUpdates.deliveryDate = new Date(deliveryDate);
    if (quantity !== undefined || price !== undefined) {
      const updatedQuantity =
        quantity !== undefined ? quantity : orderItem.quantity;
      const updatedPrice = price !== undefined ? price : orderItem.price;
      orderItemUpdates.outstandingPrice = updatedQuantity * updatedPrice;
    }

    const updatedOrderItem = await OrderItem.findOneAndUpdate(
      { orderId: new Types.ObjectId(buyOrderId) },
      { $set: orderItemUpdates },
      { new: true }
    );

    // Update Order
    const orderUpdates: Partial<IOrder> = {};
    if (orderStatus !== undefined) orderUpdates.orderStatus = orderStatus;
    if (quantity !== undefined || price !== undefined) {
      const updatedQuantity =
        quantity !== undefined ? quantity : orderItem.quantity;
      const updatedPrice = price !== undefined ? price : orderItem.price;
      orderUpdates.total = updatedQuantity * updatedPrice;
      orderUpdates.outstandingTotal = updatedQuantity * updatedPrice;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      buyOrderId,
      { $set: orderUpdates },
      { new: true }
    );

    // Update Inventory when orderStatus is "Delivered"
    if (orderStatus === "Delivered") {
      const inventory = await Inventory.findById(orderItem.inventoryId);
      if (!inventory) {
        return responseHandler(
          res,
          404,
          `Inventory not found for inventoryId: ${orderItem.inventoryId}`,
          "error"
        );
      }

      // Reduce qtyInStock by the orderItem's quantity
      const newQtyInStock = inventory.qtyInStock - orderItem.quantity;
      if (newQtyInStock < 0) {
        return responseHandler(
          res,
          400,
          `Insufficient stock for inventoryId: ${orderItem.inventoryId}`,
          "error"
        );
      }

      await Inventory.findByIdAndUpdate(
        orderItem.inventoryId,
        { $set: { qtyInStock: newQtyInStock } },
        { new: true }
      );
    }

    // Fetch additional details for the response (similar to getAllBuyOrders)
    const orderAggregate = await Order.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(buyOrderId),
        },
      },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "orderId",
          as: "orderItems",
        },
      },
      {
        $unwind: { path: "$orderItems", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "inventories",
          localField: "orderItems.inventoryId",
          foreignField: "_id",
          as: "inventory",
        },
      },
      {
        $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "clients",
          localField: "inventory.clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      {
        $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "adminproducts",
          localField: "inventory.adminProductId",
          foreignField: "_id",
          as: "adminProducts",
        },
      },
      {
        $unwind: { path: "$adminProducts", preserveNullAndEmptyArrays: true },
      },
      {
        $set: {
          clientDetails: {
            $cond: {
              if: { $eq: ["$clientDetails", {}] },
              then: { clientName: "Unknown Supplier" },
              else: "$clientDetails",
            },
          },
        },
      },
    ]);

    const updatedOrderDetails = orderAggregate[0] || {};

    responseHandler(res, 200, "Buy order updated successfully", "success", {
      _id: updatedOrder?._id,
      orderStatus: updatedOrder?.orderStatus,
      total: updatedOrder?.total,
      outstandingTotal: updatedOrder?.outstandingTotal,
      orderItem: updatedOrderItem,
      inventory: updatedOrderDetails.inventory,
      clientDetails: updatedOrderDetails.clientDetails,
      adminProducts: updatedOrderDetails.adminProducts,
    });
  } catch (error: any) {
    console.error("Error updating buy order:", {
      message: error.message,
      stack: error.stack,
      buyOrderId: req.params.buyOrderId,
      userId: req.userId,
      body: req.body,
      route: req.originalUrl,
      method: req.method,
    });
    responseHandler(
      res,
      500,
      error.message || "Internal server error",
      "error"
    );
  }
};
export {
  createBuyOrder,
  createBulkBuyOrders,
  getAllBuyOrders,
  deleteBuyOrder,
  updateBuyOrder,
};
