import mongoose, { AggregatePaginateModel, Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { AvailableOrderItemStatuses, OrderItemStatusEnum } from "../api/constants";

export interface ISellOrderItem extends Document {
  orderId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  sellPrice: number;
  status: (typeof OrderItemStatusEnum)[keyof typeof OrderItemStatusEnum];
}

type SellOrderItemModel = AggregatePaginateModel<ISellOrderItem>

const sellOrderItemSchema: Schema<ISellOrderItem> = new Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    sellPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: AvailableOrderItemStatuses,
      required: true,
      default: OrderItemStatusEnum.ORDER_INITIATED,
    },
  },
  { timestamps: true }
);

sellOrderItemSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ISellOrderItem, SellOrderItemModel>(
  "SellOrderItem",
  sellOrderItemSchema
);