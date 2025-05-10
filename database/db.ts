import mongoose from "mongoose";
import config from "../config";

export const DB = {
  async connect(): Promise<void> {
    try {
      const uri = `${config.MONGO_URI}/${config.MONGO_DB_NAME}`;
      await mongoose.connect(uri);
      console.log("✅ Connected to MongoDB");
    } catch (error: any) {
      console.error("MongoDB connection error:", error.message);
      process.exit(1);
    }
  },
};
