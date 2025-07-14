import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IOrder extends Document {
  _id: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  invoiceNumber: string;
  total: number;
  orderStatus: "Pending" | "Requested" | "Confirmed";
}

const orderSchema: Schema<IOrder> = new Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true, auto: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
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
orderSchema.plugin(mongooseAggregatePaginate);
export default mongoose.model<IOrder>("Order", orderSchema);