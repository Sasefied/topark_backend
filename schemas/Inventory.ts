import mongoose, { Document, Schema, Model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the IInventory interface
export interface IInventory extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  adminProductId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  grade: string;
  pricePerUnit: number;
  qtyInStock: number;
  qtyIncoming: number;
  sourceCountry: string;
  ccy: string;
  buyingPrice: number;
  tradingPrice: number;
}

// Define the schema
const inventorySchema: Schema<IInventory> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminProduct",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    grade: {
      type: String,
      required: true,
      uppercase: true,
    },
    pricePerUnit: {
      type: Number,
      required: true,
      default: 0,
    },
    qtyInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    qtyIncoming: {
      type: Number,
      required: true,
      default: 0,
    },
    sourceCountry: {
      type: String,
      required: true,
      uppercase: true,
    },
    ccy: {
      type: String,
      required: true,
      uppercase: true,
    },
    buyingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    tradingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

inventorySchema.plugin(mongooseAggregatePaginate);

const Inventory = mongoose.model<IInventory>("Inventory", inventorySchema);

export default Inventory;
