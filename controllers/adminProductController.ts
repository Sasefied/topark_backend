import { Request, Response } from "express";
import { AdminProduct, IAdminProduct, generateProductCode } from "../schemas/AdminProduct";
import mongoose from "mongoose";

type ProductData = Omit<IAdminProduct, keyof mongoose.Document>;

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await AdminProduct.find();
    res.status(200).json(products);
  } catch (error: any) {
    console.error("Error fetching products:", error.message, error.stack);
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const product = await AdminProduct.findById(productId);
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json(product);
  } catch (error: any) {
    console.error("Error fetching product:", error.message, error.stack);
    res.status(500).json({ message: "Error fetching product", error: error.message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productCode, ...productData }: Partial<ProductData> = req.body;
    console.log("Received productData:", productData);

    // Validate required fields
    const requiredFields: (keyof ProductData)[] = [
      "productName",
      "category",
      "basePrice",
      "quantity",
      "unit",
      "goodsPrice",
      "consTypes",
    ];
    for (const field of requiredFields) {
      if ((productData as Record<string, unknown>)[field] === undefined || (productData as Record<string, unknown>)[field] === null) {
        res.status(400).json({ message: `Missing or invalid required field: ${field}` });
        return;
      }
    }

    // Generate productCode in the controller to ensure it's set before validation
    const generatedProductCode = await generateProductCode();
    console.log("Generated productCode in controller:", generatedProductCode);

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
    res.status(500).json({ message: "Error creating product", error: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { productCode, ...updateData }: Partial<ProductData> = req.body;

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
    res.status(500).json({ message: "Error updating product", error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const deletedProduct = await AdminProduct.findByIdAndDelete(productId);
    if (!deletedProduct) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("Delete product error:", error.message, error.stack);
    res.status(500).json({ message: "Error deleting product", error: error.message });
  }
};

export const searchCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("searchCategories endpoint called with query:", req.query);
    const { query } = req.query;
    let categories: string[] = [];
    categories = await AdminProduct.distinct("category");

    // Optionally include secondaryCategory if needed
    const secondaryCategories = await AdminProduct.distinct("secondaryCategory");
    categories = [...new Set([...categories, ...secondaryCategories.filter((cat) => cat)])];

    // Filter categories if a query is provided
    if (typeof query === "string" && query.trim()) {
      const regex = new RegExp(query.trim(), "i");
      categories = categories.filter((category) => regex.test(category));
    }

    // Sort categories alphabetically
    categories.sort((a, b) => a.localeCompare(b));

    console.log("Returning categories:", categories);
    res.status(200).json({
      message: "Categories retrieved successfully",
      categories,
    });
  } catch (error: any) {
    console.error("Error searching categories:", error.message, error.stack);
    res.status(500).json({ message: "Error searching categories", error: error.message });
  }
};