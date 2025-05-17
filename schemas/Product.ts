import { Schema, model, Document, Types } from "mongoose";

export interface IProduct extends Document {
  organizationId: Types.ObjectId; // Link to Organization
  productName: string;
  quantity: number;
  pricePerUnit: number;
  shelfLife?: string; // Example: "7 days", "6 months"
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    shelfLife: { type: String },
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", ProductSchema);
