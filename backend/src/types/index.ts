export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CLOSED";
export type UserRole = "Admin" | "Member";

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

export interface User {
  userId: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

export interface JwtClaims {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}
