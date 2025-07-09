import { type User, type InsertUser, type TemporaryLink, type InsertTemporaryLink } from "@shared/schema";
import { nanoid } from "nanoid";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createTemporaryLink(link: InsertTemporaryLink): Promise<TemporaryLink>;
  getTemporaryLinkByShortId(shortId: string): Promise<TemporaryLink | undefined>;
  updateTemporaryLink(shortId: string, updates: Partial<TemporaryLink>): Promise<TemporaryLink | undefined>;
  getAllTemporaryLinks(): Promise<TemporaryLink[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private temporaryLinks: Map<string, TemporaryLink>;
  private currentUserId: number;
  private currentLinkId: number;

  constructor() {
    this.users = new Map();
    this.temporaryLinks = new Map();
    this.currentUserId = 1;
    this.currentLinkId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createTemporaryLink(insertLink: InsertTemporaryLink): Promise<TemporaryLink> {
    const id = this.currentLinkId++;
    const shortId = nanoid(12);
    const now = new Date();
    
    let expiresAt: Date | null = null;
    let maxClicks: number | null = null;
    
    if (insertLink.expirationMode === "1-click") {
      maxClicks = 1;
    } else if (insertLink.expirationMode === "1-hour") {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (insertLink.expirationMode === "24-hours") {
      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const link: TemporaryLink = {
      id,
      shortId,
      destinationUrl: insertLink.destinationUrl,
      expirationMode: insertLink.expirationMode,
      createdAt: now,
      expiresAt,
      clickCount: 0,
      maxClicks,
      isExpired: false,
    };
    
    this.temporaryLinks.set(shortId, link);
    return link;
  }

  async getTemporaryLinkByShortId(shortId: string): Promise<TemporaryLink | undefined> {
    return this.temporaryLinks.get(shortId);
  }

  async updateTemporaryLink(shortId: string, updates: Partial<TemporaryLink>): Promise<TemporaryLink | undefined> {
    const link = this.temporaryLinks.get(shortId);
    if (!link) return undefined;
    
    const updatedLink = { ...link, ...updates };
    this.temporaryLinks.set(shortId, updatedLink);
    return updatedLink;
  }

  async getAllTemporaryLinks(): Promise<TemporaryLink[]> {
    return Array.from(this.temporaryLinks.values());
  }
}

export const storage = new MemStorage();
