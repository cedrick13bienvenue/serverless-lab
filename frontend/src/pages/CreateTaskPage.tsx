import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Task } from "../types";

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.post<Task>("/tasks", { title, description });
      navigate("/");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <button onClick={() => navigate("/")}>← Back</button>
      <h1>New Task</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <strong>Title</strong>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <strong>Description</strong>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: 4 }}
            />
          </label>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create Task"}
        </button>
      </form>
    </div>
  );
}
