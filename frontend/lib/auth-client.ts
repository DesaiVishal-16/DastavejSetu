'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface SignupResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface SessionResponse {
  success: boolean;
  data: {
    user?: {
      id: string;
      email: string;
      name: string;
      image?: string;
    };
    expiresAt?: string;
  } | null;
}

export interface AuthError {
  success: false;
  message: string;
  errors?: Array<{
    code: string;
    message: string;
    path: string[];
  }>;
}

export async function signup(
  email: string,
  name: string,
): Promise<SignupResponse | AuthError> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return { success: false, message: 'Server-side call not allowed' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name }),
      credentials: 'include',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to signup:', error);
    return {
      success: false,
      message: 'Failed to create account. Please try again.',
    };
  }
}

export async function login(email: string): Promise<LoginResponse | AuthError> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return { success: false, message: 'Server-side call not allowed' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to login:', error);
    return {
      success: false,
      message: 'Failed to login. Please try again.',
    };
  }
}

export interface SessionData {
  user?: {
    id: string;
    email: string;
    name: string;
    image?: string;
  };
  expiresAt?: string;
}

export async function getSession(): Promise<SessionData | null> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
    });

    // If unauthorized or any error, return null
    if (!response.ok) {
      console.log('Session check failed:', response.status);
      return null;
    }

    const result: SessionResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

export async function logout(): Promise<boolean> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('Logout API failed:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to logout:', error);
    return false;
  }
}
