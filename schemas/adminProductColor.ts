import mongoose, { Schema } from "mongoose";

const colorSchema = new Schema({
  name: { type: String, required: true, unique: true },
});

export default mongoose.model("Color", colorSchema);