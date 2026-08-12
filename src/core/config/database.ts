import mongoose from "mongoose";
import { logger } from "../logger/logger";
import { env } from "./env";

mongoose.connection.on("connected", () => {
  logger.info("Database connected");
});

mongoose.connection.on("disconnected", () => {
  logger.warn("Database disconnected");
});

mongoose.connection.on("error", (err: Error) => {
  logger.error({ err }, "Database error");
});

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(env.MONGO_URI);
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};
