import mongoose, { Schema, Document } from "mongoose";

export interface IOrderPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  method: "cash" | "card" | "cheque";
  amount: number;
  createdBy: mongoose.Types.ObjectId;
}

const orderPaymentSchema = new Schema<IOrderPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    method: { type: String, enum: ["cash", "card", "cheque"], required: true },
    amount: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IOrderPayment>("OrderPayment", orderPaymentSchema);
