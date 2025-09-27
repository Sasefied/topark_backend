// import mongoose, { Document, Schema } from "mongoose";
// import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
// export interface IClient extends Document {
//   _id: mongoose.Types.ObjectId;
//   userId: mongoose.Types.ObjectId;
//   clientId: string;
//   clientName: string;
//   workanniversary: Date | null;
//   clientEmail: string;
//   registeredName: string;
//   registeredAddress: string;
//   deliveryAddress: string;
//   clientNotes: string;
//   companyReferenceNumber: string;
//   createdBy: {
//     _id: string;
//     firstName: string;
//     lastName: string;
//     companyName: string;
//     companyReferenceNumber: string;
//   } | null; // Allow null if createdBy is optional
//   relatedClientIds: mongoose.Types.ObjectId[];
//   creditLimit: {
//     amount: { type: Number; default: 0 };
//     period: {
//       type: Number;
//       enum: [0, 1, 7, 14, 30, 60, 90];
//     };
//   };
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// const clientSchema = new Schema<IClient>(
//   {
//     userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
//     clientId: { type: String, required: true, unique: true },
//     clientName: { type: String, required: true },
//     workanniversary: { type: Date, default: null },
//     clientEmail: {
//       type: String,
//       required: true,
//       unique: true,
//       match: /.+\@.+\..+/,
//     },
//     registeredName: { type: String, required: true },
//     registeredAddress: { type: String, default: "" },
//     deliveryAddress: { type: String, default: "" },
//     clientNotes: { type: String, default: "" },
//     companyReferenceNumber: { type: String }, // , required: true
//     createdBy: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       default: null, // Allow null if no user is associated
//     },
//     relatedClientIds: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: "Client",
//         default: [],
//       },
//     ],
//     creditLimit: {
//       amount: { type: Number, default: 0 },
//       period: {
//         type: Number,
//         enum: [0, 1, 7, 14, 30, 60, 90],
//         default: 0,
//       },
//     },
//   },
//   { timestamps: true, versionKey: false }
// );
// clientSchema.plugin(mongooseAggregatePaginate);
// const Client = mongoose.model<IClient>("Client", clientSchema);
// export default Client;



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
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    companyName: string;
    companyReferenceNumber: string;
  } | null;
  relatedClientIds: mongoose.Types.ObjectId[];
  creditLimit: {
    amount: number;
    period: number;
  };
  preference: "Client" | "Supplier";
  supplierEmails?: {
    invoiceEmail?: string;
    returnToSupplierEmail?: string;
    qualityIssueEmail?: string;
    quantityIssueEmail?: string;
    deliveryDelayEmail?: string;
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
    countryName: {type: String, default: ""},
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
    supplierEmails: {
      invoiceEmail: { type: String, default: "" },
      returnToSupplierEmail: { type: String, default: "" },
      qualityIssueEmail: { type: String, default: "" },
      quantityIssueEmail: { type: String, default: "" },
      deliveryDelayEmail: { type: String, default: "" },
    },
  },
  { timestamps: true, versionKey: false }
);

clientSchema.plugin(mongooseAggregatePaginate);
const Client = mongoose.model<IClient>("Client", clientSchema);
export default Client;