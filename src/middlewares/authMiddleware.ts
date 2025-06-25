import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  AuthenticationError,
  AuthorizationError,
} from "../errors/customErrors"; // Import custom errors

dotenv.config();
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "supersecretaccesskey";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    // Instead of res.status(401).json(...), throw an error
    return next(new AuthenticationError("No authentication token provided."));
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      // JWT errors (expired, invalid signature) will be caught by the main errorHandler
      // We still pass the original JWT error for granular handling in errorHandler
      return next(err);
    }
    req.user = user as { id: string; email: string; roles: string[] };
    next();
  });
};

export const authorizeRoles = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AuthenticationError(
          "User not authenticated for authorization check."
        )
      );
    }

    const hasPermission = requiredRoles.some((role) =>
      req.user!.roles.includes(role)
    );

    if (hasPermission) {
      next();
    } else {
      // Instead of res.status(403).json(...), throw an error
      next(
        new AuthorizationError(
          "You do not have the necessary permissions to access this resource."
        )
      );
    }
  };
};
