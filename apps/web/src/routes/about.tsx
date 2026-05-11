import { AboutView } from "@mdcz/views/about";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../client";

export const AboutPage = () => {
  const aboutQ = useQuery({ queryKey: ["system", "about"], queryFn: () => api.system.about(), retry: false });

  return (
    <AboutView
      about={aboutQ.data}
      loading={aboutQ.isLoading}
      showUpdateCheck={false}
      onOpenExternal={(url) => window.open(url, "_blank", "noopener,noreferrer")}
    />
  );
};

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
