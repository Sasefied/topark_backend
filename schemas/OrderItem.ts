import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { AvailableOrderItemStatuses, OrderItemStatusEnum } from "../api/constants";

export interface IOrderItem extends Document {
  orderId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  outstandingPrice: number;
  deliveryDate: Date;
  extraCostPrice: Number;
  status: (typeof OrderItemStatusEnum)[keyof typeof OrderItemStatusEnum];
}

const orderItemSchema: Schema<IOrderItem> = new Schema(
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
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    outstandingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    deliveryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
     extraCostPrice: { type: Number, default: 0 },
    status: {
      type: String,
      enum: AvailableOrderItemStatuses,
      default: null,
    }
  },
  { timestamps: true }
);

orderItemSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<IOrderItem>("OrderItem", orderItemSchema);


