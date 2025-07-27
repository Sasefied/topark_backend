import mongoose, { Schema, Document, Types } from "mongoose";

export type TeamRoles =
  | "Buyer"
  | "Seller"
  | "Operations"
  | "Cashier"
  | "Accountant"
  | "Admin";

export type MemberStatus = "pending" | "active" | "inactive";

export interface ITeamMember {
  _id?: Types.ObjectId;
  user?: Types.ObjectId; // Added user reference
  email: string;
  roles: TeamRoles[];
  status?: MemberStatus;
}

export interface ITeam extends Document {
  teamName: string;
  primaryUsage?: "Only Buying" | "Buying and Selling";
  createdBy: Types.ObjectId;
  // clientId: Types.ObjectId; // Reference to Client
  members?: ITeamMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

const teamMemberSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User" }, // Added user ref
    email: { type: String, required: true }, // Removed unique constraint
    roles: {
      type: [String],
      enum: ["Buyer", "Seller", "Operations", "Cashier", "Accountant", "Admin"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
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
      enum: ["Only Buying", "Buying and Selling"],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // clientId: {
    //   type: Schema.Types.ObjectId,
    //   ref: "Client",
    //   required: true,
    // },
    members: [teamMemberSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITeam>("Team", teamSchema);
