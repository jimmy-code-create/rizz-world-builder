import type { QueryClient } from "@tanstack/react-query";

/**
 * The router's one QueryClient, reachable from plain functions.
 *
 * React components use `useQueryClient()`; a data-layer function (join a realm,
 * upload an emoji) has no hook to call, and it still needs to invalidate. The
 * router registers its client here at creation, so there is exactly one cache.
 */
let client: QueryClient | null = null;

export function setQueryClient(next: QueryClient) {
  client = next;
}

export function getQueryClient(): QueryClient | null {
  return client;
}
