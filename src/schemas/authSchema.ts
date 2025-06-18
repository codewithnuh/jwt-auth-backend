import { z } from "zod";
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be minimum 8 char long"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid Email address"),
  password: z.string().min(1, "Password should not be empty"),
});
