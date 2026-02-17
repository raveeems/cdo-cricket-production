import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCachedToken, getAuthToken } from "./auth-token";

const fetchFn = Platform.OS === "web" ? globalThis.fetch.bind(globalThis) : expoFetch;

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;

  if (publicDomain) {
    return `https://${publicDomain}`;
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }

  return "";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  let token = getCachedToken();
  if (!token) {
    token = await getAuthToken();
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers = await getAuthHeaders(data ? { "Content-Type": "application/json" } : {});
  const res = await fetchFn(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const headers = await getAuthHeaders();
    const res = await fetchFn(url.toString(), {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
