import { toErrorMessage } from "@mdcz/shared/error";
import type { LibraryAvailabilityFilter } from "@mdcz/views/library";
import { LibraryIndexView } from "@mdcz/views/library";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ipc } from "@/client/ipc";
import { getImageSrc } from "@/utils/image";

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<LibraryAvailabilityFilter>("all");
  const libraryQ = useQuery({
    queryKey: ["library", "list", query],
    queryFn: () => ipc.library.list({ query }),
  });

  return (
    <LibraryIndexView
      availabilityFilter={availabilityFilter}
      entries={libraryQ.data?.entries ?? []}
      errorMessage={libraryQ.error ? toErrorMessage(libraryQ.error) : null}
      getImageSrc={getImageSrc}
      isLoading={libraryQ.isLoading}
      onAvailabilityFilterChange={setAvailabilityFilter}
      onOpenFolder={(entry) => {
        const path = entry.lastKnownPath;
        if (!path) {
          toast.error("无已知路径");
          return;
        }
        void ipc.app.showItemInFolder(path).catch((error: unknown) => {
          toast.error(toErrorMessage(error));
        });
      }}
      onQueryChange={setQuery}
      onRefresh={() => {
        void libraryQ.refetch();
      }}
      query={query}
      total={libraryQ.data?.total ?? 0}
    />
  );
}

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});
