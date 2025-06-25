export class CustomError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name; // Set the name of the error class
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, CustomError.prototype); // Maintain proper prototype chain
  }
}
// Specific authentication errors
export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed', statusCode: number = 401) {
    super(message, statusCode);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

// Specific authorization errors
export class AuthorizationError extends CustomError {
  constructor(message: string = 'Forbidden: You do not have permission to access this resource', statusCode: number = 403) {
    super(message, statusCode);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

// For validation errors (e.g., from Zod)
export class ValidationError extends CustomError {
  errors: any[]; // Store Zod's detailed errors
  constructor(message: string = 'Validation failed', errors: any[] = [], statusCode: number = 400) {
    super(message, statusCode);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// For not found errors
export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found', statusCode: number = 404) {
    super(message, statusCode);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}