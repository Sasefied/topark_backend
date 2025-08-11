import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface ICreditNote extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  orderId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  orderNumber: number;
  total: number;
}

const creditNoteSchema: Schema<ICreditNote> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    }
  },
  { timestamps: true }
);

creditNoteSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ICreditNote>("CreditNote", creditNoteSchema);