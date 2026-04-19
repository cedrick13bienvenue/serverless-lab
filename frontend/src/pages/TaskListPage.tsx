import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { api } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Task } from "../types";

export default function TaskListPage() {
  const { role } = useCurrentUser();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ tasks: Task[] }>("/tasks")
      .then((res) => setTasks(res.tasks))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading tasks…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Tasks</h1>
        <div style={{ display: "flex", gap: "1rem" }}>
          {role === "Admin" && (
            <button onClick={() => navigate("/tasks/new")}>+ New Task</button>
          )}
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Title", "Status", "Assigned To", "Updated"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ccc" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.taskId}>
                <td style={{ padding: "0.5rem" }}>
                  <Link to={`/tasks/${task.taskId}`}>{task.title}</Link>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <StatusBadge status={task.status} />
                </td>
                <td style={{ padding: "0.5rem" }}>{task.assignedTo.length} member(s)</td>
                <td style={{ padding: "0.5rem" }}>
                  {new Date(task.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "#2196F3",
    IN_PROGRESS: "#FF9800",
    DONE: "#4CAF50",
    CLOSED: "#9E9E9E",
  };
  return (
    <span
      style={{
        background: colors[status] ?? "#ccc",
        color: "#fff",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      {status}
    </span>
  );
}
