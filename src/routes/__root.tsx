import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexus ERP — Run your business in one place" },
      {
        name: "description",
        content:
          "Nexus ERP unifies sales, inventory, finance, and HR for growing businesses.",
      },
      { property: "og:title", content: "Nexus ERP — Run your business in one place" },
      {
        property: "og:description",
        content: "Sales, inventory, finance, and HR — one beautiful workspace.",
      },
      { name: "twitter:title", content: "Nexus ERP — Run your business in one place" },
      { name: "description", content: "All in one erp software!" },
      { property: "og:description", content: "All in one erp software!" },
      { name: "twitter:description", content: "All in one erp software!" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/93308fd9-414f-4504-a96d-54a126fab2d2/id-preview-4f2d878b--3af534ca-cade-4a2a-ac9c-764efb518fff.lovable.app-1779619270319.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/93308fd9-414f-4504-a96d-54a126fab2d2/id-preview-4f2d878b--3af534ca-cade-4a2a-ac9c-764efb518fff.lovable.app-1779619270319.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
