/**
 * @fileoverview Research API routes for deep research platform
 *
 * Handles initialization, messaging, dispatch, and action endpoints
 */

import type { D1Database, Ai } from "@cloudflare/workers-types";

import { zValidator } from "@hono/zod-validator";
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import { researchArtifacts } from "../db/schemas/research_artifacts";
import { researchMessages } from "../db/schemas/research_messages";
import { researchProjects } from "../db/schemas/research_projects";
import { logger } from "../lib/logger";

type Bindings = {
  DB: D1Database;
  AI: Ai;
  GEMINI_API_KEY?: string;
  R2?: any;
  LOADER?: any;
};

const researchRouter = new Hono<{ Bindings: Bindings }>();

// Initialize a new research project
researchRouter.post(
  "/init",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      title: z.string(),
      topic: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const db = drizzle(c.env.DB);

      const projectId = crypto.randomUUID();
      const now = new Date();

      await db.insert(researchProjects).values({
        id: projectId,
        userId: body.userId,
        title: body.title,
        status: "draft",
        topic: body.topic,
        tags: body.tags,
        interactionId: null,
        lastEventId: null,
        createdAt: now,
        updatedAt: now,
      });

      logger.info("Research project initialized", { projectId, userId: body.userId });

      return c.json({
        success: true,
        projectId,
        status: "draft",
      });
    } catch (error) {
      logger.error("Failed to initialize research project", error);
      return c.json({ success: false, error: "Failed to initialize project" }, 500);
    }
  },
);

// Send a message in a research project
researchRouter.post(
  "/message",
  zValidator(
    "json",
    z.object({
      projectId: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const db = drizzle(c.env.DB);

      const messageId = crypto.randomUUID();
      const now = new Date();

      // Save message to database
      await db.insert(researchMessages).values({
        id: messageId,
        projectId: body.projectId,
        role: body.role,
        content: body.content,
        createdAt: now,
      });

      // Update project timestamp
      await db
        .update(researchProjects)
        .set({ updatedAt: now })
        .where(eq(researchProjects.id, body.projectId));

      logger.info("Message saved", { messageId, projectId: body.projectId });

      // If user message, generate AI response using Workers AI
      if (body.role === "user") {
        const messages = await db
          .select()
          .from(researchMessages)
          .where(eq(researchMessages.projectId, body.projectId))
          .orderBy(desc(researchMessages.createdAt))
          .limit(10);

        const aiMessages = messages.reverse().map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        // Use Workers AI for quick response
        const response = (await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: aiMessages,
        })) as { response: string };

        const assistantMessageId = crypto.randomUUID();
        await db.insert(researchMessages).values({
          id: assistantMessageId,
          projectId: body.projectId,
          role: "assistant",
          content: response.response,
          createdAt: new Date(),
        });

        return c.json({
          success: true,
          messageId,
          assistantResponse: response.response,
        });
      }

      return c.json({
        success: true,
        messageId,
      });
    } catch (error) {
      logger.error("Failed to save message", error);
      return c.json({ success: false, error: "Failed to save message" }, 500);
    }
  },
);

// Dispatch deep research task to Gemini Interactions API
researchRouter.post(
  "/dispatch",
  zValidator(
    "json",
    z.object({
      projectId: z.string(),
      query: z.string(),
    }),
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const db = drizzle(c.env.DB);

      const geminiApiKey = c.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      // Create interaction with Gemini Deep Research API
      const interactionResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Revision": "2026-05-20",
            "x-goog-api-key": geminiApiKey,
          },
          body: JSON.stringify({
            agent: "deep-research-preview-04-2026",
            background: true,
            agent_config: {
              type: "deep-research",
              thinking_summaries: "auto",
              visualization: "auto",
            },
            prompt: body.query,
          }),
        },
      );

      if (!interactionResponse.ok) {
        throw new Error(`Gemini API error: ${interactionResponse.statusText}`);
      }

      const interaction = (await interactionResponse.json()) as { interaction_id: string };

      // Update project with interaction ID
      await db
        .update(researchProjects)
        .set({
          status: "running",
          interactionId: interaction.interaction_id,
          updatedAt: new Date(),
        })
        .where(eq(researchProjects.id, body.projectId));

      logger.info("Deep research dispatched", {
        projectId: body.projectId,
        interactionId: interaction.interaction_id,
      });

      return c.json({
        success: true,
        interactionId: interaction.interaction_id,
        status: "running",
      });
    } catch (error) {
      logger.error("Failed to dispatch research", error);
      return c.json({ success: false, error: "Failed to dispatch research" }, 500);
    }
  },
);

// Check status and get updates from Gemini interaction
researchRouter.get("/status/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const db = drizzle(c.env.DB);

    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, projectId))
      .limit(1);

    if (!project || !project.interactionId) {
      return c.json({ success: false, error: "Project not found or no interaction" }, 404);
    }

    const geminiApiKey = c.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Check interaction status
    const statusResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/interactions/${project.interactionId}`,
      {
        headers: {
          "x-goog-api-key": geminiApiKey,
        },
      },
    );

    if (!statusResponse.ok) {
      throw new Error(`Gemini API error: ${statusResponse.statusText}`);
    }

    const status = (await statusResponse.json()) as { status: string; result?: string };

    // Update project status if completed
    if (status.status === "completed") {
      await db
        .update(researchProjects)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(researchProjects.id, projectId));

      // Save result as assistant message
      if (status.result) {
        await db.insert(researchMessages).values({
          id: crypto.randomUUID(),
          projectId,
          role: "assistant",
          content: status.result,
          createdAt: new Date(),
        });
      }
    }

    return c.json({
      success: true,
      status: status.status,
      result: status.result,
    });
  } catch (error) {
    logger.error("Failed to check status", error);
    return c.json({ success: false, error: "Failed to check status" }, 500);
  }
});

// Execute action on research artifact
researchRouter.post(
  "/action",
  zValidator(
    "json",
    z.object({
      projectId: z.string(),
      action: z.enum(["pwa", "podcast", "mindmap", "dev_suite"]),
      content: z.string(),
    }),
  ),
  async (c) => {
    try {
      const body = c.req.valid("json");
      const db = drizzle(c.env.DB);

      const artifactId = crypto.randomUUID();
      const now = new Date();

      // For now, save the artifact request
      // Dynamic Workers implementation would go here
      await db.insert(researchArtifacts).values({
        id: artifactId,
        projectId: body.projectId,
        type: body.action,
        title: `${body.action} artifact`,
        content: body.content,
        publicUrl: null,
        createdAt: now,
      });

      logger.info("Artifact action created", {
        artifactId,
        projectId: body.projectId,
        action: body.action,
      });

      return c.json({
        success: true,
        artifactId,
        message: `${body.action} artifact created`,
      });
    } catch (error) {
      logger.error("Failed to execute action", error);
      return c.json({ success: false, error: "Failed to execute action" }, 500);
    }
  },
);

// Get project details
researchRouter.get("/:projectId", async (c) => {
  try {
    const projectId = c.req.param("projectId");
    const db = drizzle(c.env.DB);

    const [project] = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.id, projectId))
      .limit(1);

    if (!project) {
      return c.json({ success: false, error: "Project not found" }, 404);
    }

    const messages = await db
      .select()
      .from(researchMessages)
      .where(eq(researchMessages.projectId, projectId))
      .orderBy(researchMessages.createdAt);

    const artifacts = await db
      .select()
      .from(researchArtifacts)
      .where(eq(researchArtifacts.projectId, projectId))
      .orderBy(researchArtifacts.createdAt);

    return c.json({
      success: true,
      project,
      messages,
      artifacts,
    });
  } catch (error) {
    logger.error("Failed to get project", error);
    return c.json({ success: false, error: "Failed to get project" }, 500);
  }
});

// List all projects for a user
researchRouter.get("/list/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const db = drizzle(c.env.DB);

    const projects = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.userId, userId))
      .orderBy(desc(researchProjects.updatedAt));

    return c.json({
      success: true,
      projects,
    });
  } catch (error) {
    logger.error("Failed to list projects", error);
    return c.json({ success: false, error: "Failed to list projects" }, 500);
  }
});

export { researchRouter };
