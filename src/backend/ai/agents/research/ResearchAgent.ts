/**
 * @fileoverview Deep Research Agent - Durable Object for background tracking
 *
 * This agent handles background polling and manages Gemini Interactions API
 */

import { Agent } from "@cloudflare/agents";

import { logger } from "../../lib/logger";

export interface ResearchAgentState {
  projectId: string;
  interactionId: string | null;
  lastEventId: string | null;
  status: "idle" | "polling" | "completed" | "failed";
  result?: string;
}

export class ResearchAgent extends Agent<
  {
    GEMINI_API_KEY: string;
    DB: any;
  },
  ResearchAgentState
> {
  initialState: ResearchAgentState = {
    projectId: "",
    interactionId: null,
    lastEventId: null,
    status: "idle",
  };

  /**
   * Start tracking a Gemini interaction
   */
  async startTracking(projectId: string, interactionId: string) {
    this.setState({
      projectId,
      interactionId,
      lastEventId: null,
      status: "polling",
    });

    // Schedule periodic polling
    await this.schedule("poll", 5000); // Poll every 5 seconds

    logger.info("Started tracking research interaction", {
      projectId,
      interactionId,
    });
  }

  /**
   * Poll Gemini API for updates
   */
  async poll() {
    const state = this.state;

    if (!state.interactionId || state.status !== "polling") {
      return;
    }

    try {
      const geminiApiKey = this.env.GEMINI_API_KEY;

      // Check interaction status
      const statusRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/interactions/${state.interactionId}`,
        {
          headers: { "x-goog-api-key": geminiApiKey },
        },
      );

      if (!statusRes.ok) {
        throw new Error(`Gemini API error: ${statusRes.statusText}`);
      }

      const status = (await statusRes.json()) as {
        status: string;
        result?: string;
      };

      if (status.status !== "in_progress") {
        // Interaction completed or failed
        this.setState({
          ...state,
          status: status.status === "completed" ? "completed" : "failed",
          result: status.result,
        });

        logger.info("Research interaction completed", {
          projectId: state.projectId,
          interactionId: state.interactionId,
          status: status.status,
        });

        return;
      }

      // Get stream updates if available
      const streamUrl = state.lastEventId
        ? `https://generativelanguage.googleapis.com/v1beta/interactions/${state.interactionId}?stream=true&last_event_id=${state.lastEventId}`
        : `https://generativelanguage.googleapis.com/v1beta/interactions/${state.interactionId}?stream=true`;

      const streamRes = await fetch(streamUrl, {
        headers: { "x-goog-api-key": geminiApiKey },
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const event = JSON.parse(data) as {
                  event_id?: string;
                  type?: string;
                  content?: string;
                };

                if (event.event_id) {
                  this.setState({
                    ...this.state,
                    lastEventId: event.event_id,
                  });
                }

                // Broadcast event to connected clients
                this.broadcast({ type: "research_event", event });
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Schedule next poll
      await this.schedule("poll", 5000);
    } catch (error) {
      logger.error("Polling error", error);

      this.setState({
        ...this.state,
        status: "failed",
      });
    }
  }

  /**
   * Stop tracking
   */
  async stopTracking() {
    this.setState({
      ...this.state,
      status: "idle",
    });

    logger.info("Stopped tracking research interaction", {
      projectId: this.state.projectId,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async onMessage(message: any) {
    if (message.type === "start_tracking") {
      await this.startTracking(message.projectId, message.interactionId);
    } else if (message.type === "stop_tracking") {
      await this.stopTracking();
    } else if (message.type === "get_status") {
      this.send({ type: "status", state: this.state });
    }
  }
}
