import { Schema, model, Document, Types } from "mongoose";

export type ConnectionStatus = "pending" | "accepted" | "rejected";
export interface IConnection extends Document {
  fromOrg: Types.ObjectId;
  toOrg: Types.ObjectId;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>(
  {
    fromOrg: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    toOrg: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Connection = model<IConnection>("Connection", ConnectionSchema);
