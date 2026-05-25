/**
 * Research Chat Component
 * Interactive chat interface with assistant-ui for research projects
 */

import React, { useState, useEffect } from "react";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Textarea } from "./ui/textarea";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

interface Project {
  id: string;
  title: string;
  status: string;
  topic?: string;
}

interface ResearchChatProps {
  projectId: string;
}

export default function ResearchChat({ projectId }: ResearchChatProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const response = await fetch(`/api/research/${projectId}`);
      const data = await response.json();

      if (data.success) {
        setProject(data.project);
        setMessages(data.messages);
        setArtifacts(data.artifacts);
      }
    } catch (error) {
      console.error("Failed to load project:", error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/research/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          role: "user",
          content: userMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add user message
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId,
            role: "user",
            content: userMessage,
            createdAt: new Date(),
          },
        ]);

        // Add assistant response
        if (data.assistantResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.assistantResponse,
              createdAt: new Date(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  async function dispatchDeepResearch() {
    if (!input.trim()) return;

    setSending(true);

    try {
      const response = await fetch("/api/research/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: input,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInput("");
        await loadProject(); // Reload to get updated status
      }
    } catch (error) {
      console.error("Failed to dispatch research:", error);
    } finally {
      setSending(false);
    }
  }

  async function generateArtifact(type: "pwa" | "podcast" | "mindmap" | "dev_suite") {
    const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();

    if (!lastAssistantMessage) return;

    try {
      const response = await fetch("/api/research/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          action: type,
          content: lastAssistantMessage.content,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadProject(); // Reload to get new artifacts
      }
    } catch (error) {
      console.error(`Failed to generate ${type}:`, error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Project not found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Chat Area */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">{project.title}</h2>
            <Badge>{project.status}</Badge>
          </div>

          {/* Messages */}
          <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground ml-8"
                      : "bg-muted mr-8"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">
                    {message.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or describe your research topic..."
              className="w-full"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={sendMessage} disabled={sending || !input.trim()} className="flex-1">
                Send Message
              </Button>
              <Button
                onClick={dispatchDeepResearch}
                disabled={sending || !input.trim()}
                variant="outline"
                className="flex-1"
              >
                Deep Research
              </Button>
            </div>
          </div>
        </Card>

        {/* Artifact Actions */}
        {messages.some((m) => m.role === "assistant") && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Generate Artifacts</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => generateArtifact("pwa")} variant="outline" size="sm">
                📱 PWA Dashboard
              </Button>
              <Button onClick={() => generateArtifact("podcast")} variant="outline" size="sm">
                🎙️ Podcast
              </Button>
              <Button onClick={() => generateArtifact("mindmap")} variant="outline" size="sm">
                🗺️ Mindmap
              </Button>
              <Button onClick={() => generateArtifact("dev_suite")} variant="outline" size="sm">
                💻 Dev Suite
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Sidebar - Artifacts */}
      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Generated Artifacts</h3>

          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No artifacts yet</p>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="p-3 bg-muted rounded-lg space-y-1">
                  <div className="font-medium text-sm">{artifact.title}</div>
                  <Badge variant="outline" className="text-xs">
                    {artifact.type}
                  </Badge>
                  {artifact.publicUrl && (
                    <a
                      href={artifact.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline block"
                    >
                      View →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {project.topic && (
          <Card className="p-4">
            <h3 className="font-semibold mb-2 text-sm">Research Topic</h3>
            <p className="text-sm text-muted-foreground">{project.topic}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
