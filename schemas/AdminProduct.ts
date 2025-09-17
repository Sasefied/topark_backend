import mongoose, { Schema, model, Document } from "mongoose";
import Color from "./adminProductColor";
import Size from "./adminProductSize";

export interface IAdminProduct extends Document {
  id: string;
  productName: string;
  normalizedProductName?: string;
  productAlias?: string;
  productCode: string;
  variety?: string | null;
  referenceNumber?: string;
  size: string;
  color?: string | null;
  consTypes: "Bought" | "Commission" | "Expected";
  productType:
    | "Fruits"
    | "Vegetables"
    | "Exotic Fruits"
    | "Exotic Vegetables"
    | "Flowers";
    vat?: number;
  allowOversold: boolean;
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

export const normalizeProductName = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1")
    .trim();
};

const AdminProductSchema = new Schema<IAdminProduct>(
  {
    productName: { type: String, required: true },
    normalizedProductName: { type: String, unique: true },
    productAlias: { type: String, required: false },
    productCode: { type: String, required: true, unique: true },
    variety: { type: String, required: false, default: null },
    referenceNumber: { type: String, required: false },
    size: { type: String, required: true },
    color: { type: String, required: false, default: null },
    consTypes: {
      type: String,
      enum: ["Bought", "Commission", "Expected"],
      required: true,
    },
    productType: {
      type: String,
      enum: [
        "Fruits",
        "Vegetables",
        "Exotic Fruits",
        "Exotic Vegetables",
        "Flowers",
      ],

      required: true,
    },
    vat: {type: Number,required: true, default: false },
    allowOversold: { type: Boolean, required: true, default: false },
    comments: { type: String, required: false },
  },
  { timestamps: true, versionKey: false }
);

AdminProductSchema.pre("save", async function (next) {
  try {
    console.log("Pre-save hook triggered:", {
      isNew: this.isNew,
      productName: this.productName,
      normalizedProductName: this.normalizedProductName,
      _id: this._id,
      color: this.color,
      size: this.size,
    });

    if (!this.productName) {
      console.error("Missing productName in pre-save hook");
      return next(new Error("productName is required"));
    }

    if (this.isNew || this.isModified("productName")) {
      const normalizedName = normalizeProductName(this.productName);
      if (!normalizedName) {
        console.error(
          "Invalid normalizedProductName for productName:",
          this.productName
        );
        return next(new Error("Invalid product name: cannot normalize"));
      }
      this.normalizedProductName = normalizedName;
      console.log("Set normalizedProductName:", normalizedName);

      const existingProduct = await AdminProduct.findOne({
        normalizedProductName: normalizedName,
        _id: { $ne: this._id },
      });
      if (existingProduct) {
        console.error("Duplicate normalizedProductName found:", {
          normalizedName,
          existingProduct: existingProduct.productName,
        });
        return next(
          new Error(
            `Product with similar name "${this.productName}" already exists`
          )
        );
      }
    }

    // Define allowlists for colors and sizes
    const validColors = [
      "Red",
      "Yellow",
      "Orange",
      "Green",
      "White",
      "Blue",
      "Black",
      "Purple",
      "Pink",
      "Grey",
      // Add more as needed
    ];
    const validSizes = [
      "Small",
      "Medium",
      "Large",
      "Extra Small",
      "Extra Large",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      // Add more as needed
    ];

    // Validate and save color
    if (this.color) {
      const trimmedColor = this.color.trim();
      if (!trimmedColor) {
        this.color = null; // Handle empty color as null
      } else {
        // Check if color is mistakenly a size (allow custom colors not in allowlist)
        if (
          !validColors.includes(trimmedColor) &&
          validSizes.includes(trimmedColor)
        ) {
          return next(
            new Error(`Invalid color "${trimmedColor}": appears to be a size`)
          );
        }
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
      // Check if size is mistakenly a color (allow custom sizes not in allowlist)
      if (
        !validSizes.includes(trimmedSize) &&
        validColors.includes(trimmedSize)
      ) {
        return next(
          new Error(`Invalid size "${trimmedSize}": appears to be a color`)
        );
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

AdminProductSchema.index({ normalizedProductName: 1 }, { unique: true });
AdminProductSchema.index({ productCode: 1 }, { unique: true });

export const AdminProduct = model<IAdminProduct>(
  "AdminProduct",
  AdminProductSchema
);
