/**
 * Research Dashboard Component
 * Main interactive dashboard for managing research projects
 */

import React, { useState, useEffect } from "react";

import ResearchChat from "./ResearchChat";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface Project {
  id: string;
  title: string;
  status: "draft" | "planning" | "running" | "completed" | "failed";
  topic?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export default function ResearchDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectTopic, setNewProjectTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock user ID - in production, get from auth
  const userId = "user-1";

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const response = await fetch(`/api/research/list/${userId}`);
      const data = await response.json();

      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newProjectTitle.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/research/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          title: newProjectTitle,
          topic: newProjectTopic || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewProjectTitle("");
        setNewProjectTopic("");
        await loadProjects();
        setSelectedProject(data.projectId);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  }

  function getStatusColor(status: Project["status"]) {
    switch (status) {
      case "draft":
        return "bg-muted";
      case "planning":
        return "bg-blue-500";
      case "running":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div>
        <Button variant="outline" onClick={() => setSelectedProject(null)} className="mb-4">
          ← Back to Projects
        </Button>
        <ResearchChat projectId={selectedProject} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Create New Project */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Start New Research</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Research Title</label>
            <Input
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder="e.g., Quantum Computing Applications"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Topic / Query (optional)</label>
            <Textarea
              value={newProjectTopic}
              onChange={(e) => setNewProjectTopic(e.target.value)}
              placeholder="What would you like to research?"
              className="w-full"
              rows={3}
            />
          </div>
          <Button
            onClick={createProject}
            disabled={isCreating || !newProjectTitle.trim()}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Research Project"}
          </Button>
        </div>
      </Card>

      {/* Projects Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Your Research Projects</h2>

        {projects.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No research projects yet. Create one above to get started!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="p-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedProject(project.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg truncate flex-1">{project.title}</h3>
                    <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                  </div>

                  {project.topic && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.topic}</p>
                  )}

                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
