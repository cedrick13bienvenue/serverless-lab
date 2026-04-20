import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Task, TaskStatus } from "../types";

interface User {
  userId: string;
  email: string;
  status: string;
}

const MEMBER_STATUSES: TaskStatus[] = ["IN_PROGRESS", "DONE"];
const ADMIN_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"];

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { role, userId } = useCurrentUser();
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
      .then((t) => {
        setTask(t);
        setSelectedStatus(t.status);
      })
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
    setSaving(true);
    setError("");
    try {
      const updated = await api.put<Task>(`/tasks/${task.taskId}`, {
        status: selectedStatus,
      });
      setTask(updated);
      setSuccess("Status updated.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!task || selectedUsers.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Task>(`/tasks/${task.taskId}/assign`, { userIds: selectedUsers });
      setTask(updated);
      setSelectedUsers([]);
      setSuccess("Members assigned.");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (!task) return <p style={{ color: "red" }}>{error || "Task not found."}</p>;

  const allowedStatuses = role === "Admin" ? ADMIN_STATUSES : MEMBER_STATUSES;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <button onClick={() => navigate("/")}>← Back</button>
      <h1>{task.title}</h1>
      <p>{task.description}</p>
      <p>
        <strong>Status:</strong> {task.status}
      </p>
      <p>
        <strong>Assigned to:</strong> {task.assignedTo.join(", ") || "Nobody"}
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      <hr />
      <h3>Update Status</h3>
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value as TaskStatus)}
      >
        {allowedStatuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button onClick={handleStatusUpdate} disabled={saving} style={{ marginLeft: 8 }}>
        {saving ? "Saving…" : "Update"}
      </button>

      {role === "Admin" && (
        <>
          <hr />
          <h3>Assign Members</h3>
          {users.length === 0 ? (
            <p style={{ fontSize: 12, color: "#666" }}>No active users found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {users
                .filter((u) => !task.assignedTo.includes(u.userId))
                .map((u) => (
                  <label key={u.userId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.userId)}
                      onChange={(e) =>
                        setSelectedUsers((prev) =>
                          e.target.checked
                            ? [...prev, u.userId]
                            : prev.filter((id) => id !== u.userId)
                        )
                      }
                    />
                    {u.email}
                  </label>
                ))}
            </div>
          )}
          <button
            onClick={handleAssign}
            disabled={saving || selectedUsers.length === 0}
            style={{ marginTop: 8 }}
          >
            {saving ? "Assigning…" : `Assign (${selectedUsers.length} selected)`}
          </button>
        </>
      )}
    </div>
  );
}
