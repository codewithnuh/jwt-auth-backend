import { Response, Request } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../schemas/authSchema";
import { comparePassword, hashPassword } from "../utils/authUtils";
import { RefreshToken } from "../entities/RefreshToken";
export const userRepository = AppDataSource.getRepository(User);
const refreshTokenRepository = AppDataSource.getRepository(RefreshToken); // Get RefreshToken repository
// --- JWT Configuration (for demonstration, will use .env in production) ---
// For a production app, these MUST come from environment variables and be strong random strings!
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRATION = "1m"; // Access tokens typically short-lived (e.g., 15 minutes) // Refresh tokens are long-lived (e.g., 7 days)
const REFRESH_TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;
// --- Helper function to generate access token ---
const generateAccessToken = (
  userId: string,
  email: string,
  roles: string[]
): string => {
  return jwt.sign({ userId, email, roles }, ACCESS_TOKEN_SECRET as string, {
    expiresIn: ACCESS_TOKEN_EXPIRATION,
  });
};

// --- Helper function to generate refresh token ---
const generateRefreshTokenData = (
  userId: string,
  email: string
): { token: string; expiresAt: Date } => {
  const token = jwt.sign(
    { userId, email },
    process.env.REFRESH_TOKEN_SECRET as string,
    { expiresIn: REFRESH_TOKEN_EXPIRATION_SECONDS }
  );
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
      const newRefreshToken = refreshTokenRepository.create({
        user,
        token: newRefreshTokenString,
        userId: user.id, // Link to the user
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
      if (error instanceof Error) console.error(error.message);
      console.log(error);
      res.json({ error });
    }
  }
  static async getRefreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new Error("Refresh Token not found");
    try {
      const decoded = jwt.verify(
        refreshToken,
        REFRESH_TOKEN_SECRET as string
      ) as { userId: string; email: string; iat: number; exp: number };
      const storedRefreshToken = await refreshTokenRepository.findOne({
        where: {
          token: refreshToken,
        },
        relations: ["users"],
      });
      if (!storedRefreshToken) throw new Error("No Refresh Token found");
      if (!storedRefreshToken.user) {
        res
          .status(401)
          .json({ message: "User associated with refresh token not found." });
      }
      if (
        !storedRefreshToken ||
        storedRefreshToken.revokedAt ||
        storedRefreshToken.expiresAt < new Date()
      ) {
        // If token not found, revoked, or expired in DB, unauthorized
        res.status(401).json({ message: "Invalid or revoked refresh token." });
      }
      if (refreshToken.userId != storedRefreshToken?.userId)
        res.status(401).json({ message: "Invalid refresh token" });
      if (decoded.userId != storedRefreshToken?.userId)
        res.status(401).json({ message: " Invalid refresh token" });
      storedRefreshToken.revokedAt = new Date();
      await refreshTokenRepository.save(storedRefreshToken!);
      const newAccessToken = generateAccessToken(
        storedRefreshToken.user.id,
        storedRefreshToken.user.email,
        storedRefreshToken.user.roles
      );
      const {
        token: newRefreshTokenString,
        expiresAt: newRefreshTokenExpiresAt,
      } = generateRefreshTokenData(
        storedRefreshToken.user.id,
        storedRefreshToken.user.email
      );

      // 6. Store the new refresh token in the database
      const newStoredRefreshToken = refreshTokenRepository.create({
        token: newRefreshTokenString,
        userId: storedRefreshToken.user.id,
        expiresAt: newRefreshTokenExpiresAt,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      await refreshTokenRepository.save(newStoredRefreshToken);

      // 7. Send new tokens to client
      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenString,
      });
    } catch (error) {
      if (error instanceof Error) res.status(400).json(error.message);
    }
  }
}
