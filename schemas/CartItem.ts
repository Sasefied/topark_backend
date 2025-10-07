import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the ICartItem interface
export interface ICartItem extends Document {
  cartId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  deliveryDate: Date;
  extraCostPrice: Number;
  // orderStatus: string;
}

// Define the schema
const cartItemSchema: Schema<ICartItem> = new Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
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
     extraCostPrice: { type: Number, default: 0 },
    // orderStatus: {
    //   type: String,
    //   enum: ["Pending", "Requested", "Confirmed"],
    //   required: true,
    //   default: "Pending",
    // },
  },
  { timestamps: true }
);

const CartItem = mongoose.model<ICartItem>("CartItem", cartItemSchema);

cartItemSchema.plugin(mongooseAggregatePaginate);

export default CartItem;