import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

interface CurrentUser {
  userId: string;
  email: string;
  role: "Admin" | "Member";
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    userId: "",
    email: "",
    role: "Member",
  });

  useEffect(() => {
    fetchAuthSession().then((session) => {
      const payload = session.tokens?.idToken?.payload;
      if (!payload) return;

      const groups = (payload["cognito:groups"] as string[] | undefined) ?? [];
      setUser({
        userId: payload.sub as string,
        email: payload.email as string,
        role: groups.includes("Admins") ? "Admin" : "Member",
      });
    });
  }, []);

  return user;
}
