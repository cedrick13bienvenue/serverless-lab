import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TaskListPage from "./pages/TaskListPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import CreateTaskPage from "./pages/CreateTaskPage";
import { useCurrentUser } from "./hooks/useCurrentUser";

function AuthenticatedApp() {
  const { role } = useCurrentUser();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TaskListPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        {role === "Admin" && (
          <Route path="/tasks/new" element={<CreateTaskPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Authenticator>
      {() => <AuthenticatedApp />}
    </Authenticator>
  );
}
