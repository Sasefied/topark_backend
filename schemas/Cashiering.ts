import mongoose, { Document, Schema } from "mongoose";

// Define the ICashiering interface
export interface ICashiering extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  dayDate: Date;
  openingAmount?: number;
  openingDate?: Date;
  closingAmount?: number;
  closingDate?: Date;
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
  },
  { timestamps: true }
);

const Cashiering = mongoose.model<ICashiering>("Cashiering", cashieringSchema);

export default Cashiering;
