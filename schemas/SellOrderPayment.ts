import mongoose, { Schema, Document } from "mongoose";

export interface ISellOrderPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  method: "cash" | "card" | "cheque";
  amount: number;
  createdBy: mongoose.Types.ObjectId;
}

const sellOrderPaymentSchema = new Schema<ISellOrderPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "SellOrder", required: true },
    method: { type: String, enum: ["cash", "card", "cheque"], required: true },
    amount: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISellOrderPayment>("SellOrderPayment", sellOrderPaymentSchema);
