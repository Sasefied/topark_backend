import mongoose, { Schema, Document, model } from 'mongoose';

interface IUser extends Document {
  userId: string;
  clientId: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MyClientSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    clientId: [{ type: Schema.Types.ObjectId, ref: 'Client', required: true }],
  },
  { timestamps: true, versionKey: false }
);

// ✅ Create and export the Mongoose model
const MyClientModel = model<IUser>('MyClient', MyClientSchema);
export default MyClientModel;
