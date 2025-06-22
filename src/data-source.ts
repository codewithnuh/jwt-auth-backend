import "reflect-metadata"; // Must be imported once at the top level
import { DataSource } from "typeorm";
import { User } from "./entities/User"; // Import your User entity

// Load environment variables (we'll set this up formally next)
import dotenv from "dotenv";
import { RefreshToken } from "./entities/RefreshToken";
dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres", // Our chosen database type
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5433", 10), // Convert string to number
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root.password",
  database: process.env.DB_NAME || "jwt_db",
  synchronize: true, // Set to true for dev, false for production
  logging: process.env.NODE_ENV === "development" ? ["query", "error"] : false, // Log SQL queries in dev
  entities: [User, RefreshToken],
  relationLoadStrategy: "join", // Register your entities here
  migrations: [], // We'll talk about migrations later for production
  subscribers: [],
});

// Function to initialize the database connection
export const initializeDataSource = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("Database connected successfully!");
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1); // Exit process if database connection fails
  }
};
