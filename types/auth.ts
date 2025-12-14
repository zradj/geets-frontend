export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
}

export interface ValidationError {
  detail: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}

export interface User {
  id: string;
  username: string;
}