import { Schema, model, Document } from "mongoose";

export interface IAdminProduct extends Document {
  productName: string;
  productAlias?: string;
  productCode: string;
  variety?: string;
  referenceNumber?: string;
  category: string;
  secondaryCategory?: string;
  basePrice: number;
  quantity: number;
  unit: "Kg" | "Box" | "Palette" | "Other";
  goodsPrice: number;
  consTypes: "Bought" | "Commission" | "Expected";
  allowOversold: boolean;
  comments?: string;
}

export const generateProductCode = async (retries = 5): Promise<string> => {
  if (retries === 0) {
    throw new Error("Failed to generate unique product code after multiple attempts");
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  try {
    const existingProduct = await AdminProduct.findOne({ productCode: code });
    if (existingProduct) {
      console.log(`Product code ${code} already exists, retrying (${retries - 1} attempts left)`);
      return generateProductCode(retries - 1);
    }
    return code;
  } catch (error) {
    console.error("Error checking productCode uniqueness:", error);
    throw new Error("Failed to generate unique product code");
  }
};

const AdminProductSchema = new Schema<IAdminProduct>(
  {
    productName: { type: String, required: true, unique: true },
    productAlias: { type: String, required: false },
    productCode: { type: String, required: true, unique: true },
    variety: { type: String, required: false },
    referenceNumber: { type: String, required: false },
    category: { type: String, required: true },
    secondaryCategory: { type: String, required: false },
    basePrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, enum: ["Kg", "Box", "Palette", "Other"], required: true },
    goodsPrice: { type: Number, required: true },
    consTypes: { type: String, enum: ["Bought", "Commission", "Expected"], required: true },
    allowOversold: { type: Boolean, required: true, default: false },
    comments: { type: String, required: false },
  },
  { timestamps: true, versionKey: false }
);

AdminProductSchema.pre("save", async function (next) {
  try {
    console.log("Pre-save hook triggered for document:", {
      isNew: this.isNew,
      productCode: this.productCode,
      productName: this.productName,
    });
    if (this.isNew && !this.productCode) {
      this.productCode = await generateProductCode();
      console.log("Generated productCode in pre-save:", this.productCode);
      console.log("Document after productCode assignment:", this.toObject());
    }
    next();
  } catch (error: any) {
    console.error("Pre-save hook error:", error.message, error.stack);
    next(error);
  }
});

export const AdminProduct = model<IAdminProduct>("AdminProduct", AdminProductSchema);
