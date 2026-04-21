import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import type { Task } from "../types";

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const { darkMode, toggleDark } = useTheme();
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

        <div className="card" style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.5rem" }}>
            New Task
          </h1>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the task…"
                required
                rows={5}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Creating…" : "Create Task"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
