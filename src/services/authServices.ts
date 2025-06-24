import { Response, Request, NextFunction } from "express"; // Import NextFunction for middleware
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../schemas/authSchema";
import { comparePassword, hashPassword } from "../utils/authUtils";
import { RefreshToken } from "../entities/RefreshToken"; // Ensure this import is correct
import { MoreThan, IsNull } from "typeorm";

// Extend the Request interface to include the 'user' property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
      };
    }
  }
}

export const userRepository = AppDataSource.getRepository(User);
const refreshTokenRepository = AppDataSource.getRepository(RefreshToken); // Get RefreshToken repository

// --- JWT Configuration (for demonstration, will use .env in production) ---
// For a production app, these MUST come from environment variables and be strong random strings!
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRATION = "1m"; // Access tokens typically short-lived (e.g., 15 minutes)
const REFRESH_TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // Refresh tokens are long-lived (e.g., 7 days)

// --- Helper function to generate access token ---
const generateAccessToken = (
  userId: string,
  email: string,
  roles: string[]
): string => {
  if (!ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined.");
  }
  return jwt.sign({ userId, email, roles }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRATION,
  });
};

// --- Helper function to generate refresh token ---
const generateRefreshTokenData = (
  userId: string,
  email: string
): { token: string; expiresAt: Date } => {
  if (!REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined.");
  }
  const token = jwt.sign({ userId, email }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRATION_SECONDS,
  });
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRATION_SECONDS * 1000
  ); // Calculate actual expiry date
  return { token, expiresAt };
};

export class AuthService {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      // 1. Input Validation
      // Validate the request body against our schema
      const validationResult = registerSchema.safeParse(req.body);

      if (!validationResult.success) {
        // If validation fails, send a 400 Bad Request with validation errors
        res.status(400).json({ errors: validationResult.error.errors });
        return;
      }

      const { email, password, firstName, lastName } = validationResult.data;

      // Check if user with this email already exists
      const existingUser = await userRepository.findOneBy({ email });
      if (existingUser) {
        res
          .status(409)
          .json({ message: "User with this email already exists" });
        return;
      }

      // 2. Password Hashing
      const hashedPassword = await hashPassword(password); // Use our utility function

      // 3. Create and Save New User
      const newUser = userRepository.create({
        lastName,
        email,
        firstName,
        hashedPassword,
      });

      await userRepository.save(newUser);

      // Respond with success message (do NOT send password or hash back!)
      res.status(201).json({
        message: "User registered successfully!",
        userId: newUser.id,
        email: newUser.email,
      });
    } catch (error) {
      console.error("Error during user registration:", error);
      // In production, avoid sending detailed error messages to client
      res
        .status(500)
        .json({ message: "Internal server error during registration." });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ errors: validationResult.error.errors });
        return;
      }
      const { email, password } = validationResult.data;

      const userRepository = AppDataSource.getRepository(User);

      // 2. User Lookup
      const user = await userRepository.findOneBy({ email });
      if (!user) {
        // Be generic with error messages to avoid leaking information (e.g., "email not found")
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      // 3. Password Comparison
      const isPasswordValid = await comparePassword(
        password,
        user.hashedPassword
      );
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      // Update last_login_at
      user.lastLoginAt = new Date();
      await userRepository.save(user); // Save the updated user

      // 4. JWT (Access Token) Generation
      const accessToken = generateAccessToken(user.id, user.email, user.roles);

      const { token: newRefreshTokenString, expiresAt: refreshTokenExpiresAt } =
        generateRefreshTokenData(user.id, user.email);

      // 5. Create and save the new refresh token in the database
      const newRefreshToken = refreshTokenRepository.create({
        user, // TypeORM will use this to link the userId automatically based on the @JoinColumn
        token: newRefreshTokenString,
        userId: user.id, // Explicitly set userId as well for clarity and direct queries
        expiresAt: refreshTokenExpiresAt,
        ipAddress: req.ip, // Capture IP for auditing/security
        userAgent: req.headers["user-agent"], // Capture User-Agent for auditing/security
      });

      await refreshTokenRepository.save(newRefreshToken);

      // 6. Respond with tokens
      res.json({
        message: "Logged in successfully!",
        accessToken: accessToken,
        refreshToken: newRefreshTokenString, // Send the actual token string
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        },
      });
    } catch (error) {
      if (error instanceof Error) console.error("Login Error:", error.message);
      else console.error("Login Error:", error);
      res.status(500).json({ message: "Internal server error during login." });
    }
  }

  static async getRefreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: "Refresh Token not provided." });
      return;
    }

    try {
      // 1. Verify the refresh token's signature and decode its payload
      if (!REFRESH_TOKEN_SECRET) {
        throw new Error("REFRESH_TOKEN_SECRET is not defined.");
      }
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        userId: string;
        email: string;
        iat: number;
        exp: number;
      };

      console.log("Debug: Decoded JWT userId:", decoded.userId); // Debug log

      // 2. Look up the refresh token in the database.
      // Crucially, load the associated `user` relation because we'll need its details later.
      console.log(refreshToken);

      const storedRefreshToken = await refreshTokenRepository.findOne({
        where: {
          userId: decoded.userId, // Match by the userId from the decoded token
          token: refreshToken, // Match by the exact token string provided
          revokedAt: IsNull(), // Ensure the token has not been revoked
          expiresAt: MoreThan(new Date()), // Ensure the token has not expired in the DB
        },
        relations: ["user"], // Eagerly load the User entity associated with this refresh token
      });

      console.log(
        "Debug: Stored Refresh Token found:",
        storedRefreshToken ? "Yes" : "No (or invalid)"
      ); // Debug log
      if (storedRefreshToken) {
        console.log(
          "Debug: Stored Refresh Token user property:",
          storedRefreshToken.user ? "Present" : "Undefined/Null"
        ); // Debug log
      }

      // 3. Perform database-side validation checks
      if (!storedRefreshToken) {
        res.status(401).json({
          message:
            "Invalid, revoked, or expired refresh token. Please log in again.",
        });
        return;
      }

      // This check is very important. If storedRefreshToken exists but storedRefreshToken.user is undefined,
      // it means the relation failed to load or the related user record is missing.
      if (!storedRefreshToken.user) {
        console.error(
          "Debug Error: Stored refresh token exists but associated user is undefined."
        ); // Debug log
        res.status(401).json({
          message:
            "User associated with refresh token not found or could not be loaded.",
        });
        return;
      }
      console.log({ storedRefreshToken });
      // Check if the userId from the decoded token matches the userId in the stored token (redundant but good for safety)
      if (decoded.userId !== storedRefreshToken.userId) {
        res.status(401).json({
          message: "Invalid refresh token payload: User ID mismatch.",
        });
        return;
      }

      // If all checks pass, revoke the old refresh token (optional, but good for security - One-Time Use Refresh Tokens)
      // This makes each refresh token usable only once. A new one is issued with the new access token.
      // storedRefreshToken.revokedAt = new Date();
      // await refreshTokenRepository.save(storedRefreshToken);

      // 4. Generate a new access token
      const newAccessToken = generateAccessToken(
        storedRefreshToken.user.id,
        storedRefreshToken.user.email,
        storedRefreshToken.user.roles
      );

      // 5. Generate a new refresh token (and save it)
      // const {
      //   token: newRefreshTokenString,
      //   expiresAt: newRefreshTokenExpiresAt,
      // } = generateRefreshTokenData(
      //   storedRefreshToken.user.id,
      //   storedRefreshToken.user.email
      // );

      // const newStoredRefreshToken = refreshTokenRepository.create({
      //   user: storedRefreshToken.user, // Link to the same user
      //   userId: storedRefreshToken.user.id,
      //   expiresAt: newRefreshTokenExpiresAt,
      //   ipAddress: req.ip,
      //   userAgent: req.headers["user-agent"],
      // });
      // await refreshTokenRepository.save(newStoredRefreshToken);

      // 6. Send new tokens to client
      res.json({
        accessToken: newAccessToken,
        refreshToken: refreshToken, // Send the newly generated refresh token
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.error("JWT Error in getRefreshToken:", error.message);
        res
          .status(401)
          .json({ message: "Invalid or malformed refresh token." });
      } else if (error instanceof Error) {
        console.error("General Error in getRefreshToken:", error.message);
        res
          .status(500)
          .json({ message: "Internal server error during token refresh." });
      } else {
        console.error("Unknown error in getRefreshToken:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
      }
    }
  }

  // --- Logout Functionality ---
  static async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: "Refresh Token not provided." });
      return;
    }

    try {
      // Find and revoke the refresh token
      const tokenToRevoke = await refreshTokenRepository.findOne({
        where: {
          token: refreshToken,
          revokedAt: IsNull(), // Only revoke if not already revoked
        },
      });

      if (tokenToRevoke) {
        tokenToRevoke.revokedAt = new Date();
        await refreshTokenRepository.save(tokenToRevoke);
        res.status(200).json({ message: "Logged out successfully." });
      } else {
        res
          .status(404)
          .json({ message: "Refresh token not found or already revoked." });
      }
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Internal server error during logout." });
    }
  }

  // --- Authentication Middleware ---
  // This middleware will protect routes by verifying the access token
  static authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ message: "Access token required." });
      return;
    }

    if (!ACCESS_TOKEN_SECRET) {
      console.error(
        "ACCESS_TOKEN_SECRET is not defined for authentication middleware."
      );
      res.status(500).json({ message: "Server configuration error." });
      return;
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        console.error("JWT verification failed:", err.message);
        // Token is invalid or expired
        return res
          .status(403)
          .json({ message: "Invalid or expired access token." });
      }
      // Attach the decoded user payload to the request object
      // We are casting it to the expected type for type safety
      req.user = user as { id: string; email: string; roles: string[] };
      next(); // Proceed to the next middleware or route handler
    });
  }
}
