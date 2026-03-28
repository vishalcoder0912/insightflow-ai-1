import mongoose from "mongoose";
import { env } from "../config/env.js";

let connectionPromise = null;

export const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(env.mongoUri).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection;
};
