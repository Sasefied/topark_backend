
import mongoose, { Schema, Document, Types } from "mongoose";

export type TeamRoles =
  | "Buyer"
  | "Seller"
  | "Operations"
  | "Cashier"
  | "StockMan"
  | "Accountant"
  | "Admin";

export type MemberStatus = "pending" | "active" | "inactive";

export interface ITeamMember {
  name: any;
  user: string;
  addedOn: string;
  _id?: Types.ObjectId;
  email: string;
  roles: TeamRoles[];
  status?: MemberStatus;
}

export interface ITeam extends Document {
  teamName: string; // Changed to string
  primaryUsage?: "Only Buying" | "Buying and Selling";
  createdBy: Types.ObjectId;
  members?: ITeamMember[];
  createdAt?: Date;
  updatedAt?: Date;
 addedOn: String  
}

const teamMemberSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["Buyer", "Seller", "Operations", "Cashier", "Accountant", "StockMan", "Admin"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
    addedOn: { type: String },
  },
  { _id: true }
);

const teamSchema: Schema<ITeam> = new Schema(
  {
    teamName: { type: String, required: true, trim: true }, // Changed to String
    primaryUsage: {
      type: String,
      enum: ["Only Buying", "Buying and Selling"],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [teamMemberSchema],
    addedOn: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITeam>("Team", teamSchema);