import mongoose, { Document, Schema, Model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the IBuyOrder interface
export interface IBuyOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  deliveryDate: Date;
  orderStatus: string;
}

// Define the schema
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
    orderStatus: {
      type: String,
      enum: ["Pending", "Requested", "Confirmed"],
      required: true,
      default: "Pending",
    },
  },
  { timestamps: true }
);

buyOrderSchema.plugin(mongooseAggregatePaginate);

const BuyOrder = mongoose.model<IBuyOrder>("BuyOrder", buyOrderSchema);

export default BuyOrder;
