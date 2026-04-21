import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useTheme } from "../context/ThemeContext";
import type { Task, TaskStatus } from "../types";

interface User {
  userId: string;
  email: string;
  name: string;
  status: string;
}

const MEMBER_STATUSES: TaskStatus[] = ["IN_PROGRESS", "DONE"];
const ADMIN_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"];

const STATUS_LABELS: Record<string, string> = { IN_PROGRESS: "In Progress" };

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { role, userId } = useCurrentUser();
  const { darkMode, toggleDark } = useTheme();
  const [task, setTask] = useState<Task | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("OPEN");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get<Task>(`/tasks/${taskId}`)
      .then((t) => { setTask(t); setSelectedStatus(t.status); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    if (role === "Admin") {
      api
        .get<{ users: User[] }>("/users")
        .then((res) => setUsers(res.users.filter((u) => u.status === "ACTIVE")))
        .catch(() => {});
    }
  }, [role]);

  const handleStatusUpdate = async () => {
    if (!task) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await api.put<Task>(`/tasks/${task.taskId}`, { status: selectedStatus });
      setTask(updated);
      setSuccess("Status updated.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!task || selectedUsers.length === 0) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await api.patch<Task>(`/tasks/${task.taskId}/assign`, { userIds: selectedUsers });
      setTask(updated);
      setSelectedUsers([]);
      setSuccess("Members assigned.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const handleClose = async () => {
    if (!task) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await api.delete<Task>(`/tasks/${task.taskId}`);
      setTask(updated);
      setSuccess("Task closed.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  if (loading) return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">Task Management</span>
        <button className="theme-toggle" onClick={toggleDark}>{darkMode ? "☀️" : "🌙"}</button>
      </nav>
      <div className="page"><div className="empty-state">Loading…</div></div>
    </>
  );

  if (!task) return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">Task Management</span>
        <button className="theme-toggle" onClick={toggleDark}>{darkMode ? "☀️" : "🌙"}</button>
      </nav>
      <div className="page">
        <div className="alert alert-error">{error || "Task not found."}</div>
      </div>
    </>
  );

  const allowedStatuses = role === "Admin" ? ADMIN_STATUSES : MEMBER_STATUSES;
  const unassignedUsers = users.filter((u) => !task.assignedTo.includes(u.userId));
  const assignedNames = task.assignedTo.map((id) => {
    const u = users.find((u) => u.userId === id);
    return u ? u.name || u.email : id;
  });

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">Task Management</span>
        <button className="theme-toggle" onClick={toggleDark} title="Toggle dark mode">
          {darkMode ? "☀️" : "🌙"}
        </button>
      </nav>

      <div className="page">
        <button className="back-link" onClick={() => navigate("/")}>
          ← Back to tasks
        </button>

        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.3px" }}>{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p style={{ color: "#555", fontSize: 14, marginBottom: "1.25rem" }}>{task.description}</p>
          <div className="task-meta">
            <span><strong>Assigned to:</strong> {assignedNames.length ? assignedNames.join(", ") : "Nobody"}</span>
            <span><strong>Updated:</strong> {new Date(task.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <p className="section-title">Update Status</p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <select
              className="select"
              style={{ maxWidth: 200 }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as TaskStatus)}
            >
              {allowedStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={saving}>
              {saving ? "Saving…" : "Update"}
            </button>
          </div>
        </div>

        {role === "Admin" && task.status !== "CLOSED" && (
          <>
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <p className="section-title">Assign Members</p>
              {unassignedUsers.length === 0 ? (
                <p style={{ fontSize: 13, color: "#aaa" }}>No unassigned active users.</p>
              ) : (
                <div className="checkbox-list" style={{ marginBottom: "1rem" }}>
                  {unassignedUsers.map((u) => (
                    <label key={u.userId} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.userId)}
                        onChange={(e) =>
                          setSelectedUsers((prev) =>
                            e.target.checked ? [...prev, u.userId] : prev.filter((id) => id !== u.userId)
                          )
                        }
                      />
                      <span>
                        {u.name || u.email}
                        <span style={{ color: "#aaa", fontSize: 12, marginLeft: 6 }}>({u.email})</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={saving || selectedUsers.length === 0}
              >
                {saving ? "Assigning…" : `Assign (${selectedUsers.length} selected)`}
              </button>
            </div>

            <div className="card">
              <p className="section-title">Danger Zone</p>
              <p style={{ fontSize: 13, color: "#666", marginBottom: "0.75rem" }}>
                Closing a task marks it as complete and prevents further assignments.
              </p>
              <button className="btn btn-danger" onClick={handleClose} disabled={saving}>
                {saving ? "Closing…" : "Close Task"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    OPEN: "badge badge-open",
    IN_PROGRESS: "badge badge-progress",
    DONE: "badge badge-done",
    CLOSED: "badge badge-closed",
  };
  const labels: Record<string, string> = { IN_PROGRESS: "In Progress" };
  return <span className={cls[status] ?? "badge badge-closed"}>{labels[status] ?? status}</span>;
}
