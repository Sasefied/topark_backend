import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IOrderItem extends Document {
  _id: mongoose.Schema.Types.ObjectId;
  orderId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  deliveryDate: Date;
  productName?: string;
  supplierName?: string;
  size?: string;
  color?: string;
  orderStatus: "Pending" | "Requested" | "Confirmed";
  ccy: string;
  productId?: mongoose.Schema.Types.ObjectId;
  clientId?: mongoose.Schema.Types.ObjectId;
}

const orderItemSchema: Schema<IOrderItem> = new Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true, auto: true },
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
    deliveryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    productName: {
      type: String,
      required: false,
    },
    supplierName: {
      type: String,
      required: false,
    },
    size: {
      type: String,
      required: false,
    },
    color: {
      type: String,
      required: false,
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Requested", "Confirmed"],
      required: true,
      default: "Requested",
    },
    ccy: {
      type: String,
      required: true,
      default: "USD",
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: false,
    },
  },
  { timestamps: true }
);

orderItemSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<IOrderItem>("OrderItem", orderItemSchema);