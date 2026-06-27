import { TOOL_DEFINITIONS, type ToolId } from "@mdcz/shared/toolCatalog";
import { ToolsRouteView } from "@mdcz/views/tools";
import { createFileRoute } from "@tanstack/react-router";
import { ToolDetail } from "./tools/ToolDetail";

export const ToolsPage = () => {
  return <ToolsRouteView tools={TOOL_DEFINITIONS} renderDetail={(toolId: ToolId) => <ToolDetail toolId={toolId} />} />;
};

export const Route = createFileRoute("/tools")({
  component: ToolsPage,
});
