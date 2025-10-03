import mongoose, { Schema, model, Document } from "mongoose";
import Color from "./adminProductColor";
import Size from "./adminProductSize";

export interface IAdminProduct extends Document {
  id: string;
  productName: string;
  productAlias?: string;
  productCode: string;
  variety?: string | null;
  referenceNumber?: string;
  size: string;
  color?: string | null;
  productType:
    | "Fruits"
    | "Vegetables"
    | "Exotic Fruits"
    | "Exotic Vegetables"
    | "Flowers"
    | "Exotic Flowers"
    | "Plants"
    | "Garden Plants";
  comments?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const generateProductCode = async (
  productName: string,
  variety?: string | null,
  retries = 5,
  suffix: number | null = null
): Promise<string> => {
  if (retries === 0) {
    throw new Error(
      "Failed to generate unique product code after multiple attempts"
    );
  }

  const cleanedName = productName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const baseCode =
    cleanedName.length >= 3
      ? cleanedName.slice(0, 3)
      : cleanedName.padEnd(3, "X");

  const randomDigits =
    variety && variety.trim() !== ""
      ? Math.floor(100 + Math.random() * 900).toString()
      : Math.floor(10 + Math.random() * 90).toString();

  const code = `${baseCode}-${randomDigits}${suffix ? `-${suffix}` : ""}`;

  try {
    const existingProduct = await AdminProduct.findOne({ productCode: code });
    if (existingProduct) {
      console.log(
        `Product code ${code} already exists, retrying (${
          retries - 1
        } attempts left)`
      );
      return generateProductCode(
        productName,
        variety,
        retries - 1,
        suffix ? suffix + 1 : 1
      );
    }
    return code;
  } catch (error) {
    console.error("Error checking productCode uniqueness:", error);
    throw new Error("Failed to generate unique product code");
  }
};

const AdminProductSchema = new Schema<IAdminProduct>(
  {
    productName: { type: String, required: true },
    productAlias: { type: String, required: false },
    productCode: { type: String, required: true, unique: true },
    variety: { type: String, required: false, default: null },
    referenceNumber: { type: String, required: false },
    size: { type: String, required: true },
    color: { type: String, required: false, default: null },
    productType: {
      type: String,
      enum: [
        "Fruits",
        "Vegetables",
        "Exotic Fruits",
        "Exotic Vegetables",
        "Flowers",
        "Exotic Flowers",
        "Plants",
        "Garden Plants",
      ],
      required: true,
    },
    comments: { type: String, required: false },
  },
  { timestamps: true, versionKey: false }
);

AdminProductSchema.pre("save", async function (next) {
  try {
    console.log("Pre-save hook triggered:", {
      isNew: this.isNew,
      productName: this.productName,
      _id: this._id,
      color: this.color,
      size: this.size,
    });

    if (!this.productName) {
      console.error("Missing productName in pre-save hook");
      return next(new Error("productName is required"));
    }

    // Validate and save color
    if (this.color) {
      const trimmedColor = this.color.trim();
      if (!trimmedColor) {
        this.color = null; // Handle empty color as null
      } else {
        await Color.findOneAndUpdate(
          { name: trimmedColor },
          { name: trimmedColor },
          { upsert: true }
        );
        console.log("Saved/updated color:", trimmedColor);
        this.color = trimmedColor;
      }
    }

    // Validate and save size
    if (this.size) {
      const trimmedSize = this.size.trim();
      if (!trimmedSize) {
        return next(new Error("Size cannot be empty"));
      }
      await Size.findOneAndUpdate(
        { name: trimmedSize },
        { name: trimmedSize },
        { upsert: true }
      );
      console.log("Saved/updated size:", trimmedSize);
      this.size = trimmedSize;
    } else {
      return next(new Error("Size is required"));
    }

    next();
  } catch (error: any) {
    console.error("Pre-save hook error:", error.message, error.stack);
    next(error);
  }
});

AdminProductSchema.index({ productCode: 1 }, { unique: true });

export const AdminProduct = model<IAdminProduct>(
  "AdminProduct",
  AdminProductSchema
);