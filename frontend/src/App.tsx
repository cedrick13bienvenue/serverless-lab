import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { useTheme } from "./context/ThemeContext";
import TaskListPage from "./pages/TaskListPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import CreateTaskPage from "./pages/CreateTaskPage";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { ThemeProvider } from "./context/ThemeContext";

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

function AuthPage() {
  const { darkMode, toggleDark } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <>
      {!isAuthenticated && (
        <button
          className="theme-toggle"
          onClick={toggleDark}
          style={{ position: "fixed", top: 16, right: 16, zIndex: 100 }}
          title="Toggle dark mode"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      )}
      <Authenticator
        signUpAttributes={["name"]}
        formFields={{
          signUp: {
            name: { label: "Full Name", placeholder: "John Doe", order: 1 },
            email: { order: 2 },
            password: { order: 3 },
            confirm_password: { order: 4 },
          },
          signIn: {
            username: { label: "Email", placeholder: "Enter your email" },
          },
        }}
      >
        {() => {
          setIsAuthenticated(true);
          return <AuthenticatedApp />;
        }}
      </Authenticator>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthPage />
    </ThemeProvider>
  );
}
