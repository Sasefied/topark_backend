import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface ISellOrderItem extends Document {
  orderId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  sellPrice: number;
}

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
  },
  { timestamps: true }
);

sellOrderItemSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ISellOrderItem>(
  "SellOrderItem",
  sellOrderItemSchema
);
