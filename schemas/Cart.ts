import mongoose, { Document, Schema } from "mongoose";

// Define the ICart interface
export interface ICart extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
}

// Define the schema
const cartSchema: Schema<ICart> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
  },
  { timestamps: true }
);

const Cart = mongoose.model<ICart>("Cart", cartSchema);

export default Cart;