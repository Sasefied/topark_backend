import mongoose, { Document, Schema } from "mongoose";

export interface IClient extends Document {
  _id: mongoose.Types.ObjectId;
  clientId: string;
  clientName: string;
  workanniversary: Date | null;
  clientEmail: string;
  registeredName: string;
  registeredAddress: string;
  deliveryAddress: string;
  clientNotes: string;
  createdBy: mongoose.Types.ObjectId;
  companyReferenceNumber: string;
  relatedClientIds: mongoose.Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const clientSchema = new Schema<IClient>(
  {
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true },
    workanniversary: { type: Date, default: null },
    clientEmail: {
      type: String,
      required: true,
      unique: true,
      match: /.+\@.+\..+/,
    },
    registeredName: { type: String, required: true },
    registeredAddress: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    clientNotes: { type: String, default: "" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyReferenceNumber: { type: String, required: true },
    relatedClientIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Client",
        default: [],
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

const Client = mongoose.model<IClient>("Client", clientSchema);
export default Client;
