import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  teamId: mongoose.Schema.Types.ObjectId;
  invoiceNumber: string;
  total: number;
  outstandingTotal: number;
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
      required: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    outstandingTotal: {
      type: Number,
      min: 0,
      required: true,
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Delivered"],
      required: true,
      default: "Pending",
    },
  },
  { timestamps: true }
);

orderSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<IOrder>("Order", orderSchema);
