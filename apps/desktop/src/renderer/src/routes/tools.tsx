import { TOOL_DEFINITIONS, type ToolId } from "@mdcz/shared/toolCatalog";
import { ToolsRouteView } from "@mdcz/views/tools";
import { createFileRoute } from "@tanstack/react-router";
import { ToolDetail } from "@/components/tool/ToolDetail";

export const Route = createFileRoute("/tools")({
  component: ToolComponent,
});

function ToolComponent() {
  return <ToolsRouteView tools={TOOL_DEFINITIONS} renderDetail={(toolId: ToolId) => <ToolDetail toolId={toolId} />} />;
}
