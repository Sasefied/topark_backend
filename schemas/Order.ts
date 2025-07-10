import mongoose, { Document, Schema } from "mongoose";

export interface IOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  invoiceNumber: string;
  total: number;
  orderStatus: string;
}

const orderSchema: Schema<IOrder> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: false,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Requested", "Confirmed"],
      required: true,
      default: "Requested",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IOrder>("Order", orderSchema);