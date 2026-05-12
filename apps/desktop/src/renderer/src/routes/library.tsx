import { toErrorMessage } from "@mdcz/shared/error";
import type { LibraryEntryDto } from "@mdcz/shared/serverDtos";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@mdcz/ui";
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
  const [deleteTarget, setDeleteTarget] = useState<LibraryEntryDto | null>(null);
  const [deleteMediaFiles, setDeleteMediaFiles] = useState(false);
  const libraryQ = useQuery({
    queryKey: ["library", "list", query],
    queryFn: () => ipc.library.list({ query }),
  });

  return (
    <>
      <LibraryIndexView
        availabilityFilter={availabilityFilter}
        entries={libraryQ.data?.entries ?? []}
        errorMessage={libraryQ.error ? toErrorMessage(libraryQ.error) : null}
        getImageSrc={getImageSrc}
        isLoading={libraryQ.isLoading}
        onAvailabilityFilterChange={setAvailabilityFilter}
        onDeleteEntry={setDeleteTarget}
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
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteMediaFiles(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>从媒体库移除</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-quiet bg-surface-low px-4 py-3 text-sm font-medium text-foreground">
            <Checkbox
              checked={deleteMediaFiles}
              id="delete-media-files"
              onCheckedChange={(checked) => setDeleteMediaFiles(checked === true)}
            />
            <label className="cursor-pointer" htmlFor="delete-media-files">
              同时删除媒体文件
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteMediaFiles(false);
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = deleteTarget;
                if (!target) return;
                void deleteLibraryEntry(target, deleteMediaFiles, () => {
                  setDeleteTarget(null);
                  setDeleteMediaFiles(false);
                  void libraryQ.refetch();
                });
              }}
            >
              确认移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function deleteLibraryEntry(entry: LibraryEntryDto, deleteMediaFiles: boolean, onSuccess: () => void) {
  try {
    await ipc.library.delete({ deleteMediaFiles, id: entry.id });
    toast.success("已从媒体库移除");
    onSuccess();
  } catch (error) {
    toast.error(toErrorMessage(error));
  }
}

export const Route = createFileRoute("/library")({
  component: LibraryPage,
});
