import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/PortalShell";

export const Route = createFileRoute("/portal")({
  component: () => <PortalShell />,
});
