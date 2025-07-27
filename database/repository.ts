import { customAlphabet } from "nanoid";
import User, { IUser } from "../schemas/User";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

class Repository {
  // Get user by email using Mongoose
  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  // Example method to create a user (optional)
  async createUser(data: Partial<IUser>): Promise<IUser> {
    const newUser = new User(data);
    return await newUser.save();
  }

  // Example method to generate a unique ID
  generateId(): string {
    return nanoid();
  }
}

export default Repository;
