import api from "./api";
import type { LoginCredentials, SignupCredentials, TokenResponse, User } from "../types/auth";

export const authService = {
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const formData = new FormData();
    formData.append("username", credentials.email);
    formData.append("password", credentials.password);

    const response = await api.post<TokenResponse>(`/auth/login`, formData);
    return response.data;
  },

  async signup(credentials: SignupCredentials): Promise<User> {
    const response = await api.post<User>(`/auth/signup`, credentials);
    return response.data;
  },
};
