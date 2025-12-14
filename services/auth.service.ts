import { LoginRequest, AuthResponse } from '@/types/auth';

const API_BASE_URL = 'http://localhost:8000';

export class AuthService {
  static async register(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  }

  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        throw new Error('Incorrect username or password');
      }
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  }

  static saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  static getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  static removeToken(): void {
    localStorage.removeItem('auth_token');
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}