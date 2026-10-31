import { z } from "zod";

export const createEndpointSchema = z.object({
  appName: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(50, "App name cannot exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s]+$/, "App name can only contain letters, numbers, and spaces"),
  apiKey: z.string().min(16, "API Key must be at least 16 characters long"),
});

export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").regex(/^[a-zA-Z\s-]+$/),
  lastName: z.string().min(1, "Last name is required").regex(/^[a-zA-Z\s-]+$/),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "VIEWER"]),
});

export const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["SUPERADMIN", "ADMIN", "VIEWER"]),
});

export const MIN_REPORT_LIMIT = 1;
export const MAX_REPORT_LIMIT = 1000;
export const DEFAULT_REPORT_LIMIT = 20;

export const reportQuerySchema = z.object({
  slug: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  directive: z.string().optional(),
  domain: z.string().optional(),
  disposition: z.enum(["enforce", "report"]).optional(),
  unique: z.boolean().optional(),
  sort: z.enum(["newest", "oldest", "domain"]).default("newest"),
  limit: z.number().int().min(MIN_REPORT_LIMIT).max(MAX_REPORT_LIMIT).default(DEFAULT_REPORT_LIMIT),
});
