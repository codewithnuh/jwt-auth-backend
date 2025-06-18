import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv"; // Import dotenv
import { initializeDataSource } from "./data-source"; // Import the database initializer
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes";
// Load environment variables from .env file
dotenv.config();
// Function to check for required environment variables
function ensureEnvVariables(): void {
  const requiredEnv = ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];

  for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
      // If any required environment variable is missing, throw an error
      // This will prevent the application from starting in a misconfigured state
      throw new Error(
        `Missing required environment variable: ${envVar}. Please check your .env file.`
      );
    }
  }

  // You can also add more specific checks, e.g., for secret length
  if (
    process.env.ACCESS_TOKEN_SECRET!.length < 32 ||
    process.env.REFRESH_TOKEN_SECRET!.length < 32
  ) {
    console.warn(
      "WARNING: JWT secrets are too short! Use long, random strings (e.g., 32+ characters) for production."
    );
    // You might even throw an error here in production environments
    // throw new Error('JWT secrets are too short for production.');
  }
}

// Call this function at the very beginning of your application startup
try {
  ensureEnvVariables();
  console.log("All required environment variables are present.");
} catch (error: any) {
  console.error("Environment variable configuration error:", error.message);
  process.exit(1); // Exit the process with an error code
}
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (as before)
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(
    `[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl} from ${
      req.ip
    }`
  );
  next();
});

// Routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the main API entry point!" });
});

// Error Handling Middleware (must be last)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});
// Initialize database connection and then start the server
initializeDataSource()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log("Press CTRL+C to stop the server");
    });
  })
  .catch((error) => {
    console.error(
      "Failed to start server due to database connection error:",
      error
    );
    process.exit(1); // Exit if DB connection fails
  });
