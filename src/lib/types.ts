export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const MEMORY_CATEGORIES = [
  "preference",
  "profile",
  "project_decision",
  "workflow",
  "important_fact",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  current_phase: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  projects?: { name: string } | null;
};

export type Note = {
  id: string;
  project_id: string | null;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  note_tags: { tag: string }[];
  projects?: { name: string } | null;
};

export type Memory = {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  importance: number;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type ProjectOption = { id: string; name: string };