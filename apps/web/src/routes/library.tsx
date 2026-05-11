import { toErrorMessage } from "@mdcz/shared/error";
import type { LibraryAvailabilityFilter } from "@mdcz/views/library";
import { LibraryIndexView } from "@mdcz/views/library";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { api, getLibraryAssetSrc } from "../client";
import { AppLink } from "../routeCommon";

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<LibraryAvailabilityFilter>("all");
  const libraryQ = useQuery({
    queryKey: ["library", "search", query],
    queryFn: () => api.library.search({ query, limit: 300 }),
    retry: false,
  });

  return (
    <LibraryIndexView
      availabilityFilter={availabilityFilter}
      entries={libraryQ.data?.entries ?? []}
      errorMessage={libraryQ.error ? toErrorMessage(libraryQ.error) : null}
      getImageSrc={(path, entry) => getLibraryAssetSrc({ path, rootId: entry.rootId })}
      isLoading={libraryQ.isLoading}
      linkComponent={LibraryEntryLink}
      onAvailabilityFilterChange={setAvailabilityFilter}
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

function LibraryEntryLink({
  children,
  className,
  entry,
}: {
  children: ReactNode;
  className?: string;
  entry: { scrapeOutputId: string | null };
}) {
  if (!entry.scrapeOutputId) {
    return null;
  }

  return (
    <AppLink className={className} to={`/scrape/${encodeURIComponent(entry.scrapeOutputId)}`}>
      {children}
    </AppLink>
  );
}
