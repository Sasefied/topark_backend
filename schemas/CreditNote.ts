import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface ICreditNote extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  total: number;
  url?: string;
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
    },
    url: {
      type: String,
    },
  },
  { timestamps: true }
);

creditNoteSchema.plugin(mongooseAggregatePaginate);

export default mongoose.model<ICreditNote>("CreditNote", creditNoteSchema);
