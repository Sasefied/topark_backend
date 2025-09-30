import { Request, Response } from "express";
import {
  AdminProduct,
  IAdminProduct,
  generateProductCode,
} from "../schemas/AdminProduct";
import mongoose from "mongoose";
import Color from "../schemas/adminProductColor";
import Size from "../schemas/adminProductSize";

type ProductData = Omit<IAdminProduct, keyof mongoose.Document>;

export const getAllProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      AdminProduct.find().skip(skip).limit(limit),
      AdminProduct.countDocuments(),
    ]);

    res.status(200).json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching products:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
};

export const getProductById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: "Invalid product ID format" });
      return;
    }

    const product = await AdminProduct.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json(product);
  } catch (error: any) {
    console.error("Error fetching product:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error fetching product", error: error.message });
  }
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productCode, ...productDataRaw } = req.body;
    const productData: Partial<ProductData> = productDataRaw;
    console.log("Received productData:", productData);

    const requiredFields: (keyof ProductData)[] = [
      "productName",
      "size",
      "productType",
    ];
    for (const field of requiredFields) {
      if (
        !(field in productData) ||
        productData[field] === undefined ||
        productData[field] === null
      ) {
        res
          .status(400)
          .json({ message: `Missing or invalid required field: ${field}` });
        return;
      }
    }

    const generatedProductCode = await generateProductCode(
      productData.productName!,
      productData.variety
    );
    console.log("Generated productCode:", generatedProductCode);

    const newProduct = new AdminProduct({
      ...productData,
      productCode: generatedProductCode,
    });
    await newProduct.save();
    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (error: any) {
    console.error("Create product error:", error.message, error.stack);
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((err) => ({
        path: err.path,
        message: err.message,
      }));
      res.status(400).json({ message: "Validation error", errors });
      return;
    }
    res
      .status(500)
      .json({ message: "Error creating product", error: error.message });
  }
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { productCode, ...updateData }: Partial<ProductData> = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: "Invalid product ID format" });
      return;
    }

    const updatedProduct = await AdminProduct.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error: any) {
    console.error("Update product error:", error.message, error.stack);
    if (error instanceof mongoose.Error.ValidationError) {
      const errors = Object.values(error.errors).map((err) => ({
        path: err.path,
        message: err.message,
      }));
      res.status(400).json({ message: "Validation error", errors });
      return;
    }
    res
      .status(500)
      .json({ message: "Error updating product", error: error.message });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: "Invalid product ID format" });
      return;
    }

    const deletedProduct = await AdminProduct.findByIdAndDelete(productId);
    if (!deletedProduct) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("Delete product error:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Error deleting product", error: error.message });
  }
};

export const checkProductName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("checkProductName called with query:", req.query);
    const { productName } = req.query;
    if (!productName || typeof productName !== "string") {
      res
        .status(400)
        .json({ message: "Product name is required and must be a string" });
      return;
    }
    res.status(200).json({ exists: false });
  } catch (error) {
    console.error("Error checking product name:", error);
    res.status(500).json({ message: "Failed to check product name" });
  }
};

export const getColors = async (req: Request, res: Response): Promise<void> => {
  console.log("getColors called with params:", req.params, "query:", req.query);
  try {
    const colors = await Color.find().select("name");
    if (!colors.length) {
      res.status(404).json({ message: "No colors found" });
    }
    res.status(200).json(
      colors.map((color) => {
        return color.name;
      })
    );
  } catch (error) {
    console.error("Error fetching colors:", error);
    res.status(500).json({ message: "Failed to fetch colors" });
  }
};

export const getSizes = async (req: Request, res: Response): Promise<void> => {
  try {
    const sizes = await Size.find().select("name");
    if (!sizes.length) {
      res.status(404).json({ message: "No sizes found" });
    }
    res.status(200).json(sizes.map((size) => size.name));
  } catch (error) {
    console.error("Error fetching sizes:", error);
    res.status(500).json({ message: "Failed to fetch sizes" });
  }
};