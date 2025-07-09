import { z } from "zod";

// TypeScript types for in-memory storage
export interface User {
  id: number;
  username: string;
  password: string;
}

export interface TemporaryLink {
  id: number;
  shortId: string;
  destinationUrl: string;
  expirationMode: "1-click" | "1-hour" | "24-hours";
  createdAt: Date;
  expiresAt: Date | null;
  clickCount: number;
  maxClicks: number | null;
  isExpired: boolean;
}

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertTemporaryLinkSchema = z.object({
  destinationUrl: z.string()
    .trim()
    .min(1, "Please enter a URL to shorten")
    .url("Please enter a valid URL"),
  expirationMode: z.enum(["1-click", "1-hour", "24-hours"]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTemporaryLink = z.infer<typeof insertTemporaryLinkSchema>;
