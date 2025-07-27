import mongoose, { Document, Schema, Types } from "mongoose";
import crypto from "crypto";

export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyEmail: string;
  password: string;
  companyName: string;
  companyReferenceNumber?: string;
  consentGiven?: boolean;
  roles: string[];
  teamId: mongoose.Types.ObjectId;
  status?: "pending" | "active" | "inactive";
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  createPasswordResetToken: () => string;
}

const userSchema: Schema<IUser> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    companyEmail: {type: String, required: true, unique: true},
    password: { type: String, required: true },
    companyName: { type: String, required: true },
    companyReferenceNumber: { type: String, required: true, unique: true },
   
    consentGiven: { type: Boolean, required: true, default: false },
    roles: [
      {
        type: String,
        enum: ["Admin", "Buyer", "Seller", "Cashier", "Accountant", "Operations"],
        default: ["Admin"],
      },
    ],
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  return resetToken;
};

const User = mongoose.model<IUser>("User", userSchema);
export default User;