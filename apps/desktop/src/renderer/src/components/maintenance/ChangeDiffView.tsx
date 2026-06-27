import { SceneImageGallery } from "@mdcz/views/detail";
import {
  type ChangeDiffViewProps,
  type MaintenanceSceneImageOptionProps,
  ChangeDiffView as SharedChangeDiffView,
} from "@mdcz/views/maintenance";
import { resolveDesktopImageCandidates } from "@/adapters/ports";

const renderSceneImages = (props: MaintenanceSceneImageOptionProps) => (
  <SceneImageGallery {...props} resolveImageCandidates={resolveDesktopImageCandidates} />
);

export default function ChangeDiffView(props: ChangeDiffViewProps) {
  return (
    <SharedChangeDiffView
      {...props}
      renderSceneImages={renderSceneImages}
      resolveImageCandidates={resolveDesktopImageCandidates}
    />
  );
}
