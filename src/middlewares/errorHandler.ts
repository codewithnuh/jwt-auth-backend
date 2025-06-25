import { Request, Response, NextFunction } from "express";
import {
  CustomError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from "../errors/customErrors";
import jwt from "jsonwebtoken"; // For specific JWT error handling
// This is our main error handling middleware
export const errorHandler = (
  err: Error, // The error object
  req: Request,
  res: Response,
  next: NextFunction // Even though we usually send a response here, next is required for the signature
) => {
  // Log the error for debugging (structured logging will come next!)
  console.error(`Error: ${err.name} - ${err.message}`);
  // In development, you might log the stack trace: console.error(err.stack);

  let statusCode = 500;
  let message = "An unexpected error occurred.";
  let errors: any[] | undefined; // For validation errors

  if (err instanceof CustomError) {
    // If it's one of our custom errors, use its properties
    statusCode = err.statusCode;
    message = err.message;
    if (err instanceof ValidationError) {
      errors = err.errors;
    }
  } else if (err instanceof jwt.JsonWebTokenError) {
    // Handle specific JWT library errors
    statusCode = 403; // Forbidden, as token is invalid or malformed
    message = "Invalid or malformed token.";
    if (err.name === "TokenExpiredError") {
      statusCode = 401; // Unauthorized, specifically for expired tokens
      message = "Authentication failed: Token has expired.";
    }
  } else if (err instanceof Error) {
    // Catch any other standard JavaScript Error object
    statusCode = 500;
    message = err.message; // Use the error message as-is for now
  }
  // Default to 500 for any other unhandled errors

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    ...(errors && { errors }), // Only include errors array if present (e.g., for validation)
  });
};
