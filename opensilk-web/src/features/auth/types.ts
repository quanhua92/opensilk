export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
