import { Schema, model, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export const Organization = model<IOrganization>(
  "Organization",
  OrganizationSchema
);
