import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Task, TaskStatus } from "../types";

const MEMBER_STATUSES: TaskStatus[] = ["IN_PROGRESS", "DONE"];
const ADMIN_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"];

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { role, userId } = useCurrentUser();
  const [task, setTask] = useState<Task | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("OPEN");
  const [assignInput, setAssignInput] = useState("");
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
    if (!task || !assignInput.trim()) return;
    const userIds = assignInput.split(",").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Task>(`/tasks/${task.taskId}/assign`, { userIds });
      setTask(updated);
      setAssignInput("");
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
          <p style={{ fontSize: 12, color: "#666" }}>
            Enter user IDs separated by commas
          </p>
          <input
            value={assignInput}
            onChange={(e) => setAssignInput(e.target.value)}
            placeholder="user-id-1, user-id-2"
            style={{ width: "100%", padding: "0.4rem" }}
          />
          <button onClick={handleAssign} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Assigning…" : "Assign"}
          </button>
        </>
      )}
    </div>
  );
}
