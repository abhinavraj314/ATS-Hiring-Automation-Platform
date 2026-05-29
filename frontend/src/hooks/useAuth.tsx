import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, TokenResponse } from "../types/auth";
import api from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (data: TokenResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem("token");
    return savedToken === "null" || savedToken === "undefined" ? null : savedToken;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      // Optional: Fetch user profile if token exists but user is null
      if (!user) {
        api.get("/auth/me")
          .then(res => setUser(res.data))
          .catch(() => logout());
      }
    } else {
      localStorage.removeItem("token");
      setUser(null);
    }
  }, [token]);

  const login = (data: TokenResponse) => {
    setToken(data.access_token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
