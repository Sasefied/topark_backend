import mongoose, { AggregatePaginateModel, Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { AvailableOrderStatuses, OrderStatusEnum } from "../api/constants";

export interface ISellOrder extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  invoiceUrl: string;
  orderNumber: number;
  total: number;
  shipToday: boolean;
  hasNegativeStock?: boolean;
  status: (typeof OrderStatusEnum)[keyof typeof OrderStatusEnum];
}

type SellOrderModel = AggregatePaginateModel<ISellOrder>;

const sellOrderSchema: Schema<ISellOrder> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    invoiceUrl: {
      type: String,
    },
    orderNumber: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    shipToday: {
      type: Boolean,
      required: true,
      default: false,
    },
    hasNegativeStock: { type: Boolean, default: false },
    status: {
      type: String,
      enum: AvailableOrderStatuses,
      required: true,
      default: OrderStatusEnum.ORDER_PRINTED,
    },
  },
  { timestamps: true }
);

sellOrderSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ISellOrder, SellOrderModel>(
  "SellOrder",
  sellOrderSchema
);
