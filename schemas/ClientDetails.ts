import mongoose, { Document, Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

export interface IClient extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  clientId: string;
  clientName: string;
  workanniversary: Date | null;
  clientEmail: string;
  registeredName: string;
  registeredAddress: string;
  deliveryAddress: string;
  countryName: string;
  clientNotes: string;
  companyReferenceNumber: string;
  createdBy: mongoose.Types.ObjectId;
  relatedClientIds: mongoose.Types.ObjectId[];
  creditLimit: {
    amount: number;
    period: number;
  };
  preference: "Client" | "Supplier";
  supplier?: {
    creditLimitAmount: number;
    creditLimitDays: number;
    invoiceEmail: string;
    returnToSupplierEmail: string;
    quantityIssueEmail: string;
    qualityIssueEmail: string;
    deliveryDelayIssueEmail: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const clientSchema = new Schema<IClient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    workanniversary: { type: Date, default: null },
    clientEmail: {
      type: String,
      required: true,
      unique: true,
      match: /.+\@.+\..+/,
    },
    countryName: { type: String, default: "" },
    registeredName: { type: String, required: true },
    registeredAddress: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    clientNotes: { type: String, default: "" },
    companyReferenceNumber: { type: String, default: "" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    relatedClientIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Client",
        default: [],
      },
    ],
    creditLimit: {
      amount: { type: Number, default: 0 },
      period: {
        type: Number,
        enum: [0, 1, 7, 14, 30, 60, 90],
        default: 0,
      },
    },
    preference: {
      type: String,
      enum: ["Client", "Supplier"],
      required: true,
      default: "Client",
    },
    supplier: {
      type: {
        creditLimitAmount: { type: Number, default: 0 },
        creditLimitDays: {
          type: Number,
          enum: [0, 1, 7, 14, 30, 60, 90],
          default: 0,
        },
        invoiceEmail: {
          type: String,
          required: false,
          match: /.+\@.+\..+/,
          default: "",
        },
        returnToSupplierEmail: {
          type: String,
          required: false,
          match: /.+\@.+\..+/,
          default: "",
        },
        quantityIssueEmail: {
          type: String,
          required: false,
          match: /.+\@.+\..+/,
          default: "",
        },
        qualityIssueEmail: {
          type: String,
          required: false,
          match: /.+\@.+\..+/,
          default: "",
        },
        deliveryDelayIssueEmail: {
          type: String,
          required: false,
          match: /.+\@.+\..+/,
          default: "",
        },
      },
      required: false,
      default: undefined,
    },
  },
  { timestamps: true, versionKey: false }
);

// Validation for supplier fields
clientSchema.pre("validate", function (next) {
  if (this.preference === "Supplier" && !this.supplier) {
    this.supplier = {
      creditLimitAmount: 0,
      creditLimitDays: 0,
      invoiceEmail: "",
      returnToSupplierEmail: "",
      quantityIssueEmail: "",
      qualityIssueEmail: "",
      deliveryDelayIssueEmail: "",
    };
  }
  next();
});

clientSchema.index({ preference: 1 });
clientSchema.index({ userId: 1 });

clientSchema.plugin(mongooseAggregatePaginate);
const Client = mongoose.model<IClient>("Client", clientSchema);
export default Client;
