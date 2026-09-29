import axios, { type InternalAxiosRequestConfig } from "axios";
import { supabase } from "./supabase";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

type RetryableRequest = InternalAxiosRequestConfig & { sessionRetried?: boolean };
let sessionRefresh: ReturnType<typeof supabase.auth.refreshSession> | null = null;

api.interceptors.response.use(response => response, async error => {
  const request = error.config as RetryableRequest | undefined;
  if (error.response?.status !== 401 || !request || request.sessionRetried) throw error;
  request.sessionRetried = true;
  // Concurrent requests share one refresh; never log out a valid user for an API error.
  if (!sessionRefresh) {
    sessionRefresh = supabase.auth.refreshSession().finally(() => { sessionRefresh = null; });
  }
  const { data, error: refreshError } = await sessionRefresh;
  if (refreshError || !data.session) throw error;
  request.headers.Authorization = `Bearer ${data.session.access_token}`;
  return api(request);
});
