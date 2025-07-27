

import mongoose, { Document, Schema, Model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IBuyOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  productName: string;
  supplierName: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  ccy: string;
  deliveryDate: Date;
  orderStatus: string;
}

const buyOrderSchema: Schema<IBuyOrder> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    productName: { type: String, required: true },
    supplierName: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true, default: 0 },
    ccy: { type: String, required: true, default: "USD" },
    deliveryDate: { type: Date, required: true, default: Date.now },
    orderStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Delivered"],
      required: true,
      default: "Pending",
    },
  },
  { timestamps: true }
);

buyOrderSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<IBuyOrder>("BuyOrder", buyOrderSchema);