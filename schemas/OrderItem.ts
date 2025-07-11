import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// export interface IOrderItem extends Document {
//   orderId: mongoose.Schema.Types.ObjectId;
//   inventoryId: mongoose.Schema.Types.ObjectId;
//   quantity: number;
//   price: number;
//   deliveryDate: Date;
// }

// const orderItemSchema: Schema<IOrderItem> = new Schema(
//   {
//     orderId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Order",
//       required: true,
//     },
//     inventoryId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "AdminProduct",
//       required: true,
//     },
//     quantity: {
//       type: Number,
//       required: true,
//       default: 0,
//     },
//     price: {
//       type: Number,
//       required: true,
//       default: 0,
//     },
//     deliveryDate: {
//       type: Date,
//       required: true,
//       default: Date.now,
//     },
//   },
//   { timestamps: true }
// );

// orderItemSchema.plugin(mongooseAggregatePaginate);

// export default mongoose.model<IOrderItem>("OrderItem", orderItemSchema);

export interface IOrderItem extends Document {
  orderId: mongoose.Schema.Types.ObjectId;
  inventoryId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  quantity: number;
  price: number;
  deliveryDate: Date;
  productName?: string;
  supplierName?: string;
  size?: string;
  color?: string;
}

const orderItemSchema: Schema<IOrderItem> = new Schema(
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
    clientId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "clients",
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
    productName: {
      type: String,
      required: false,
    },
    supplierName: {
      type: String,
      required: false,
    },
    size: {
      type: String,
      required: false,
    },
    color: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

orderItemSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<IOrderItem>("OrderItem", orderItemSchema);