import { ProviderNotFoundError } from "@/errors.ts";
import type { Provider } from "@/types.ts";

const providers = new Map<string, () => Provider>();

/** Register a provider factory */
export function registerProvider(name: string, factory: () => Provider): void {
  providers.set(name, factory);
}

/** Get a provider instance by name */
export function getProvider(name: string): Provider {
  const factory = providers.get(name);
  if (!factory) {
    throw new ProviderNotFoundError(name);
  }
  return factory();
}

/** List all registered provider names */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}
