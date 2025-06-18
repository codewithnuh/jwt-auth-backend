import express, { Request, Response, NextFunction } from "express"; // Import NextFunction
import userRoutes from "./routes/userRoutes";
import helmet from "helmet"; // Will need to install: npm install helmet
import cors from "cors"; // Will need to install: npm install cors

const app = express();
const PORT = process.env.PORT || 3000;

// --- Global Middleware ---

// 1. Security Headers: Helps secure your apps by setting various HTTP headers
//    npm install helmet
app.use(helmet());

// 2. CORS: Enable Cross-Origin Resource Sharing
//    Allows your frontend (on a different domain) to talk to your backend
//    npm install cors
//    For production, you'd configure specific origins:
//    app.use(cors({ origin: 'https://yourfrontend.com' }));
app.use(cors());

// 3. Body Parser for JSON: Parses incoming JSON requests and puts the parsed data in req.body
app.use(express.json());

// 4. Custom Logger Middleware (for demonstration)
app.use((req: Request, res: Response, next: NextFunction) => {
  req.body = { name: "Modified Name" };
  console.log(
    `[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl} from ${
      req.ip
    }`
  );
  next(); // Pass control to the next middleware function
});

// --- Routing ---
app.use("/api/users", userRoutes);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the main API entry point!" });
});

// --- Error Handling Middleware (will discuss more in detail later) ---
// This should be the last app.use()
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(500).send("Something broke!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
