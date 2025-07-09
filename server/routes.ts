import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTemporaryLinkSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create a temporary link
  app.post("/api/links", async (req, res) => {
    try {
      const validatedData = insertTemporaryLinkSchema.parse(req.body);
      const link = await storage.createTemporaryLink(validatedData);
      res.json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Get link details
  app.get("/api/links/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      const link = await storage.getTemporaryLinkByShortId(shortId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      // Check if link is expired
      const now = new Date();
      let isExpired = link.isExpired;
      
      if (!isExpired) {
        if (link.expiresAt && now > link.expiresAt) {
          isExpired = true;
        }
        if (link.maxClicks && link.clickCount >= link.maxClicks) {
          isExpired = true;
        }
      }
      
      if (isExpired && !link.isExpired) {
        await storage.updateTemporaryLink(shortId, { isExpired: true });
      }
      
      res.json({ ...link, isExpired });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Redirect to destination URL
  app.get("/t/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      const link = await storage.getTemporaryLinkByShortId(shortId);
      
      if (!link) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Link Not Found</title>
              <meta charset="utf-8">
              <script>
                window.location.href = '/redirect-handler/${shortId}';
              </script>
            </head>
            <body>
              <p>Redirecting...</p>
            </body>
          </html>
        `);
      }
      
      // Check if link is expired
      const now = new Date();
      let isExpired = link.isExpired;
      
      if (!isExpired) {
        if (link.expiresAt && now > link.expiresAt) {
          isExpired = true;
        }
        if (link.maxClicks && link.clickCount >= link.maxClicks) {
          isExpired = true;
        }
      }
      
      if (isExpired) {
        return res.status(410).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Link Expired</title>
              <meta charset="utf-8">
              <script>
                window.location.href = '/redirect-handler/${shortId}';
              </script>
            </head>
            <body>
              <p>Redirecting...</p>
            </body>
          </html>
        `);
      }
      
      // Increment click count
      const newClickCount = link.clickCount + 1;
      let newIsExpired = false;
      
      if (link.maxClicks && newClickCount >= link.maxClicks) {
        newIsExpired = true;
      }
      
      await storage.updateTemporaryLink(shortId, {
        clickCount: newClickCount,
        isExpired: newIsExpired,
      });
      
      res.redirect(link.destinationUrl);
    } catch (error) {
      console.error("Error in redirect handler:", error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <meta charset="utf-8">
            <script>
              window.location.href = '/redirect-handler/${shortId}';
            </script>
          </head>
          <body>
            <p>Redirecting...</p>
          </body>
        </html>
      `);
    }
  });

  // Delete a link
  app.delete("/api/links/:shortId", async (req, res) => {
    try {
      const { shortId } = req.params;
      const link = await storage.getTemporaryLinkByShortId(shortId);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      await storage.updateTemporaryLink(shortId, { isExpired: true });
      res.json({ message: "Link deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
