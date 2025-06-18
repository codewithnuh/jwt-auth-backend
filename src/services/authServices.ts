import { Response, Request } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import jwt from "jsonwebtoken";
import { loginSchema, registerSchema } from "../schemas/authSchema";
import { comparePassword, hashPassword } from "../utils/authUtils";
export const userRepository = AppDataSource.getRepository(User);
// --- JWT Configuration (for demonstration, will use .env in production) ---
// For a production app, these MUST come from environment variables and be strong random strings!
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRATION = "15m"; // Access tokens typically short-lived (e.g., 15 minutes)
const REFRESH_TOKEN_EXPIRATION = "7d"; // Refresh tokens are long-lived (e.g., 7 days)

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
const generateRefreshToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email }, REFRESH_TOKEN_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRATION,
  });
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

      // 5. Refresh Token Creation/Storage (more detailed implementation later with RefreshToken entity)
      // For now, we'll generate it, but we need a proper database table to store and manage them.
      // This is a placeholder. In a production app, you'd save this to the refresh_tokens table.
      const refreshToken = generateRefreshToken(user.id, user.email);

      // 6. Respond with tokens
      res.json({
        message: "Logged in successfully!",
        accessToken: accessToken,
        refreshToken: refreshToken,
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
}
