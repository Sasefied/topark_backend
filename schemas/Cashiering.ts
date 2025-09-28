import mongoose, { Document, Schema, Model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

// Define the ICashiering interface
export interface ICashiering extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  dayDate: Date;
  openingAmount?: number;
  openingDate?: Date;
  closingAmount?: number;
  closingDate?: Date;
  invoiceUrl?: string;
}

// Extend the Model interface to include aggregatePaginate
interface CashieringModel extends Model<ICashiering> {
  aggregatePaginate: (
    aggregate: any,
    options: any
  ) => Promise<{
    cashierings: ICashiering[];
    totalCashierings: number;
    [key: string]: any;
  }>;
}

// Define the schema
const cashieringSchema: Schema<ICashiering> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dayDate: {
      type: Date,
      required: true,
    },
    openingAmount: {
      type: Number,
      default: 0,
    },
    openingDate: {
      type: Date,
    },
    closingAmount: {
      type: Number,
      default: 0,
    },
    closingDate: {
      type: Date,
    },
    invoiceUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

// Apply the plugin before creating the model
cashieringSchema.plugin(mongooseAggregatePaginate);

// Create the model
const Cashiering: CashieringModel = mongoose.model<ICashiering, CashieringModel>("Cashiering", cashieringSchema);

export default Cashiering;