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
    companyEmail: {type: String, required: true, unique: true},
    password: { type: String, required: true },
    companyName: { type: String, required: true },
    companyReferenceNumber: { type: String, required: true, unique: true },
   
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
export default User;