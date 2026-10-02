import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Flame,
  FolderKanban,
  MessageSquare,
  Plus,
  StickyNote,
  Sun,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cardClass } from "@/lib/styles";
import type { TaskPriority } from "@/lib/types";
import {
  OPEN_STATUSES,
  PRIORITY_STYLE,
  formatDate,
  longDate,
  pretty,
  safeTz,
  sortTasks,
  todayIn,
} from "@/lib/utils";

type DashTask = {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  status: string;
  projects: { name: string }[] | null;
};

const ACTIONS: { label: string; icon: LucideIcon; href: string | null }[] = [
  { label: "Ask Luna", icon: MessageSquare, href: null },
  { label: "Add task", icon: Plus, href: "/tasks?new=1" },
  { label: "Save note", icon: StickyNote, href: "/notes?new=1" },
  { label: "Start focus session", icon: Timer, href: null },
  { label: "Morning briefing", icon: Sun, href: null },
];

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-xs text-slate-400">{title}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function TaskItem({ task }: { task: DashTask }) {
  const projectName = task.projects?.[0]?.name ?? "No project";

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{task.title}</p>

        <p className="truncate text-xs text-slate-500">
          {projectName}
          {task.due_date ? ` - due ${formatDate(task.due_date)}` : ""}
        </p>
      </div>

      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
          PRIORITY_STYLE[task.priority]
        }`}
      >
        {pretty(task.priority)}
      </span>
    </li>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profileRes, tasksRes, projectsRes, notesRes, memoriesRes, activityRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,timezone")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("tasks")
        .select("id,title,priority,due_date,status,projects(name)")
        .in("status", OPEN_STATUSES),

      supabase
        .from("projects")
        .select("id,name,current_phase,next_action")
        .eq("status", "active")
        .order("updated_at", { ascending: false }),

      supabase.from("notes").select("id", { count: "exact", head: true }),

      supabase
        .from("assistant_memories")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      supabase
        .from("tool_audit_logs")
        .select("id,action_type,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const firstError = [
    profileRes,
    tasksRes,
    projectsRes,
    notesRes,
    memoriesRes,
    activityRes,
  ].find((result) => result.error)?.error;

  const tz = safeTz(profileRes.data?.timezone);
  const today = todayIn(tz);

  const firstName = profileRes.data?.full_name?.split(" ")[0] ?? "there";

  const tasks = sortTasks((tasksRes.data ?? []) as DashTask[]);

  const dueToday = tasks.filter((task) => task.due_date === today);

  const overdue = tasks.filter(
    (task) => task.due_date !== null && task.due_date < today
  );

  const priorityTask = tasks[0] ?? null;

  const projects = (projectsRes.data ?? []) as {
    id: string;
    name: string;
    current_phase: string | null;
    next_action: string | null;
  }[];

  const activity = (activityRes.data ?? []) as {
    id: string;
    action_type: string;
    status: string;
    created_at: string;
  }[];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-slate-400">{longDate(tz)}</p>

      <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
        Hello, {firstName}
      </h1>

      {firstError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          Some data failed to load: {firstError.message}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat title="Open tasks" value={tasks.length} />

        <Stat
          title="Due today"
          value={dueToday.length}
          tone="text-cyan-300"
        />

        <Stat
          title="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "text-red-300" : undefined}
        />

        <Stat title="Active projects" value={projects.length} />

        <Stat title="Notes" value={notesRes.count ?? 0} />

        <Stat title="Memories" value={memoriesRes.count ?? 0} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-slate-300">
          Quick actions
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {ACTIONS.map(({ label, icon: Icon, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                className={`${cardClass} flex flex-col items-start gap-2 p-4 text-sm transition hover:border-cyan-500/50`}
              >
                <Icon size={18} className="text-cyan-300" />
                <span>{label}</span>
              </Link>
            ) : (
              <div
                key={label}
                aria-disabled="true"
                className={`${cardClass} flex cursor-not-allowed flex-col items-start gap-2 p-4 text-sm text-slate-500`}
              >
                <Icon size={18} />
                <span>{label}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  Soon
                </span>
              </div>
            )
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <Flame size={16} className="text-orange-300" />
            Priority task
          </h2>

          {priorityTask ? (
            <ul>
              <TaskItem task={priorityTask} />
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No open tasks.</p>
          )}
        </section>

        <section className={`${cardClass} p-5`}>
          <h2 className="mb-2 text-sm font-medium text-slate-300">Today</h2>

          {dueToday.length > 0 ? (
            <ul className="divide-y divide-slate-800">
              {dueToday.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing due today.</p>
          )}
        </section>

        <section className={`${cardClass} p-5`}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
            <FolderKanban size={16} className="text-indigo-300" />
            Active projects
          </h2>

          {projects.length > 0 ? (
            <ul className="divide-y divide-slate-800">
              {projects.slice(0, 5).map((project) => (
                <li key={project.id} className="py-2">
                  <p className="text-sm">{project.name}</p>

                  <p className="truncate text-xs text-slate-500">
                    {project.next_action
                      ? `Next: ${project.next_action}`
                      : project.current_phase ?? "No next action"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No active projects.</p>
          )}
        </section>

        <section className={`${cardClass} p-5`}>
          <h2 className="mb-2 text-sm font-medium text-slate-300">
            Recent Luna activity
          </h2>

          {activity.length > 0 ? (
            <ul className="divide-y divide-slate-800">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {pretty(item.action_type)}
                  </span>

                  <span className="shrink-0 text-xs text-slate-500">
                    {pretty(item.status)} -{" "}
                    {new Date(item.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: tz,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}