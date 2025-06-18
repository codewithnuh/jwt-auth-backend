import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// Extend the Express Request interface to include the user property
// This allows us to attach user information to the request object after authentication
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        roles: string[];
      };
    }
  }
}
// Ensure your ACCESS_TOKEN_SECRET matches what's in your .env
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("[DEBUg]: Auth middleware");
  // 1. Extract the token from the Authorization header
  // The header typically looks like: "Authorization: Bearer <TOKEN>"
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Get the token part after "Bearer "

  if (token == null) {
    // If no token is provided, return 401 Unauthorized
    return res
      .status(401)
      .json({ message: "Access Denied: No token provided" });
  }

  // 2. Verify the token
  jwt.verify(token, ACCESS_TOKEN_SECRET as string, (err, user) => {
    if (err) {
      // If token is invalid or expired, return 403 Forbidden
      // 'JsonWebTokenError' for invalid signature, 'TokenExpiredError' for expired token
      console.error("JWT Verification Error:", err.message);
      return res
        .status(403)
        .json({ message: "Access Denied: Invalid or expired token" });
    }

    // 3. Attach user information to the request object
    // Cast 'user' to the expected type that matches our JWT payload structure
    req.user = user as { userId: string; email: string; roles: string[] };

    // 4. Pass control to the next middleware or route handler
    next();
  });
};
