export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CLOSED";

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdBy: string;
  assignedTo: string[];
  createdAt: string;
  updatedAt: string;
}
