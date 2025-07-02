import mongoose, { Document, Schema } from "mongoose"

export interface IInventory extends Document {
  adminProductId: mongoose.Schema.Types.ObjectId
  product: string
  size: string
  color: string
  grade: string
  pricePerUnit: number
  qtyInStock: number
  qtyIncoming: number
  sourceCountry: string
  ccy: string
  buyingPrice: number
  tradingPrice: number
}

const inventorySchema: Schema<IInventory> = new Schema(
  {
    adminProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminProduct",
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
)

const Inventory = mongoose.model<IInventory>("Inventory", inventorySchema)

export default Inventory