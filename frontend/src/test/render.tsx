import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { api } from "@/shared/api";
import { MetaProvider } from "@/shared/meta";
import { ToastProvider } from "@/shared/ui";

import { META } from "./fixtures";

/** GET javoblari: yo'l (so'rov qatori bilan) → javob. Kutilmagan yo'l xato beradi — noto'g'ri URL darrov ko'rinadi. */
export function mockGet(routes: Record<string, unknown>) {
  const all: Record<string, unknown> = { "/meta/": META, ...routes };
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path in all) return all[path] as never;
    throw new Error(`Kutilmagan GET: ${path}`);
  });
}

export function renderApp(ui: ReactNode, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <MetaProvider userKey={1}>{ui}</MetaProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
