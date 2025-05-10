import mongoose, { Schema, Document, Types } from "mongoose";

export type TeamRole =
  | "Trader"
  | "Seller"
  | "Supplier"
  | "Operations"
  | "Cashier"
  | "Sales"
  | "Accountant"
  | "Admin";

export type MemberStatus = "pending" | "active";

export interface ITeamMember {
  _id?: Types.ObjectId;
  email: string;
  roles: TeamRole[];
  status?: "pending" | "active";
}

export interface ITeam extends Document {
  teamName: string;
  primaryUsage?: "Buying" | "Selling" | "Buying and Selling";
  createdBy: Types.ObjectId;
  members?: ITeamMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

const teamMemberSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    roles: {
      type: [String],
      enum: [
        "Trader",
        "Seller",
        "Supplier",
        "Operations",
        "Cashier",
        "Sales",
        "Accountant",
        "Admin",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active"],
      default: "pending",
    },
  },
  { _id: true }
);

const teamSchema: Schema<ITeam> = new Schema(
  {
    teamName: { type: String, required: true },
    primaryUsage: {
      type: String,
      enum: ["Buying", "Selling", "Buying and Selling"],
      default: "Buying and Selling",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [teamMemberSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITeam>("Team", teamSchema);
