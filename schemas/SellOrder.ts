import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface ISellOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  orderNumber: number;
  total: number;
  outstandingTotal: number;
}

const sellOrderSchema: Schema<ISellOrder> = new Schema(
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
    orderNumber: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    }
  },
  { timestamps: true }
);

sellOrderSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ISellOrder>("SellOrder", sellOrderSchema);
