import mongoose, { Document, Schema, Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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
  isOfflineUser?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createPasswordResetToken: () => string;
   isPasswordCorrect: (password: string) => Promise<boolean>;
}

const userSchema: Schema<IUser> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
  // companyEmail can be optional; remove direct unique here and create a sparse unique index below
  companyEmail: { type: String },
    password: { type: String, required: true },
    companyName: { type: String, required: false },
  // companyReferenceNumber optional; enforce uniqueness only when present via sparse index
  companyReferenceNumber: { type: String, required: false },
   
    consentGiven: { type: Boolean, required: true, default: false },
    roles: [
      {
        type: String,
        enum: ["Admin", "Buyer", "Seller", "Cashier", "Accountant", "Operations","StockMan"],
        default: ["Admin"],
      },
    ],
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    isOfflineUser: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
})

userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  return resetToken;
};
userSchema.methods.isPasswordCorrect = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
}

const User = mongoose.model<IUser>("User", userSchema);
// Sparse unique indexes so multiple null / missing values don't collide
userSchema.index({ companyEmail: 1 }, { unique: true, sparse: true });
userSchema.index({ companyReferenceNumber: 1 }, { unique: true, sparse: true });

export default User;