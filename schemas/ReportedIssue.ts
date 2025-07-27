import { Schema, model, Document } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

interface IReportedIssue extends Document {
  orderId: Schema.Types.ObjectId;
  orderItemId: Schema.Types.ObjectId;
  issueCategory: string;
  receivedQuantity?: number;
  proof?: string;
  additionalNotes?: string;
  productUnusable?: boolean;
  productUnAcceptable?: boolean;
  issue?: string;
  productCompletelyDifferent?: boolean;
}

const ReportedIssueSchema = new Schema<IReportedIssue>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderItemId: {
      type: Schema.Types.ObjectId,
      ref: "OrderItem",
      required: true,
    },
    issueCategory: {
      type: String,
      required: true,
      enum: ["Quantity mismatch", "Quality issue", "Wrong Variety", "Other"],
    },
    receivedQuantity: { type: Number },
    proof: { type: String },
    additionalNotes: { type: String },
    productUnusable: { type: Boolean },
    productUnAcceptable: { type: Boolean },
    issue: { type: String, required: true },
    productCompletelyDifferent: { type: Boolean },
  },
  {
    timestamps: true,
  }
);

ReportedIssueSchema.plugin(mongooseAggregatePaginate);

export default model<IReportedIssue>("ReportedIssue", ReportedIssueSchema);
