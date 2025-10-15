import mongoose, { Document, Schema, Model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the IInventory interface
export interface IInventory extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  adminProductId: mongoose.Schema.Types.ObjectId;
  clientId?: mongoose.Schema.Types.ObjectId;
  orderItemId: mongoose.Schema.Types.ObjectId;
  teamId: mongoose.Schema.Types.ObjectId;
  size: string;
  color?: string | null;
  vat?: number;
  sellBy:
    | "Box"
    | "Kg"
    | "Unit"
    | "Dozen"
    | "Liter"
    | "Packet"
    | "Gram"
    | "Pound"
    | "Ounce"
    | "Milliliter";
  sellByQuantity: string;
  shelfLife: string;
  season: string[];
  countryOfOrigin: string;
  qtyInStock: number;
  qtyIncoming: number;
  tradingPrice: number;
  variety?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
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
      required: false,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
      required: false,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    vat: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    sellBy: {
      type: String,
      enum: [
        "Box",
        "Kg",
        "Unit",
        "Dozen",
        "Liter",
        "Packet",
        "Gram",
        "Pound",
        "Ounce",
        "Milliliter",
      ],
      required: true,
    },
    sellByQuantity: { type: String, required: false, default: "" },

    shelfLife: {
      type: String,
      required: true,
      min: 0,
    },
    season: [
      {
        type: String,
        enum: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
        required: true,
      },
    ],

    countryOfOrigin: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    qtyInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    tradingPrice: {
      type: Number,
      default: 0,
    },
    qtyIncoming: {
      type: Number,
      required: true,
      default: 0,
    },
    variety: { type: String, required: false, default: null },
  },
  { timestamps: true }
);

// Add mongoose-aggregate-paginate-v2 plugin
inventorySchema.plugin(mongooseAggregatePaginate);

// Create and export the model
const Inventory: Model<IInventory> = mongoose.model<IInventory>(
  "Inventory",
  inventorySchema
);

export default Inventory;
