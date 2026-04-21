import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { api } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useTheme } from "../context/ThemeContext";
import type { Task } from "../types";

interface User {
  userId: string;
  name: string;
  email: string;
}

export default function TaskListPage() {
  const { role } = useCurrentUser();
  const { darkMode, toggleDark } = useTheme();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ tasks: Task[] }>("/tasks")
      .then((res) => setTasks(res.tasks))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (role === "Admin") {
      api
        .get<{ users: User[] }>("/users")
        .then((res) => setUsers(new Map(res.users.map((u) => [u.userId, u]))))
        .catch(() => {});
    }
  }, [role]);

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">Task Management</span>
        <div className="navbar-actions">
          {role === "Admin" && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/tasks/new")}>
              + New Task
            </button>
          )}
          <button className="theme-toggle" onClick={toggleDark} title="Toggle dark mode">
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="page">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty-state">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet.</p>
            {role === "Admin" && (
              <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => navigate("/tasks/new")}>
                Create your first task
              </button>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.taskId}>
                    <td>
                      <Link to={`/tasks/${task.taskId}`} style={{ fontWeight: 500 }}>
                        {task.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td style={{ color: "#555" }}>
                      {task.assignedTo.length === 0
                        ? <span style={{ color: "#bbb" }}>Nobody</span>
                        : role === "Admin"
                        ? task.assignedTo.map((id) => users.get(id)?.name || users.get(id)?.email || id).join(", ")
                        : `${task.assignedTo.length} member(s)`}
                    </td>
                    <td style={{ color: "#888" }}>
                      {new Date(task.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const labels: Record<string, string> = {
    IN_PROGRESS: "In Progress",
  };
  return <span className={cls[status] ?? "badge badge-closed"}>{labels[status] ?? status}</span>;
}
