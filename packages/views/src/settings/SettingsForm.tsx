import { Search } from "lucide-react";
import { AdvancedSettingsFooterContent } from "./SettingsFooter";
import { useSettingsSearch } from "./SettingsSearchContext";
import { useCrawlerSiteOptions } from "./settingsContent";
import {
  AdvancedTopLevelSection,
  DownloadTopLevelSection,
  FileBehaviorTopLevelSection,
  NamingTopLevelSection,
  NetworkTopLevelSection,
  PathsTopLevelSection,
  ScrapeTopLevelSection,
  SystemTopLevelSection,
  TranslateTopLevelSection,
} from "./TopLevelSections";

interface SettingsFormProps {
  flatDefaults: Record<string, unknown>;
  initialUseCustomTitleBar: boolean;
}

export function SettingsForm({ flatDefaults, initialUseCustomTitleBar }: SettingsFormProps) {
  const siteOptions = useCrawlerSiteOptions(flatDefaults);
  const search = useSettingsSearch();

  return (
    <div className="space-y-12">
      {search.hasActiveFilters && search.resultCount === 0 ? (
        <SettingsEmptyState />
      ) : (
        <>
          <PathsTopLevelSection forceOpen={search.isSectionForceOpen("paths")} />
          <ScrapeTopLevelSection siteOptions={siteOptions} forceOpen={search.isSectionForceOpen("scrape")} />
          <NetworkTopLevelSection forceOpen={search.isSectionForceOpen("network")} />
          <TranslateTopLevelSection forceOpen={search.isSectionForceOpen("translate")} />
          <NamingTopLevelSection forceOpen={search.isSectionForceOpen("naming")} />
          <DownloadTopLevelSection forceOpen={search.isSectionForceOpen("download")} />
          <FileBehaviorTopLevelSection forceOpen={search.isSectionForceOpen("fileBehavior")} />
          <SystemTopLevelSection
            initialUseCustomTitleBar={initialUseCustomTitleBar}
            forceOpen={search.isSectionForceOpen("system")}
          />
          <AdvancedTopLevelSection
            siteOptions={siteOptions}
            forceOpen={search.isSectionForceOpen("advancedSettings")}
          />
        </>
      )}

      <AdvancedSettingsFooter />
    </div>
  );
}

function SettingsEmptyState() {
  return (
    <div className="rounded-[var(--radius-quiet-xl)] border border-border/40 bg-surface px-6 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-low text-muted-foreground">
        <Search className="h-5 w-5" />
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-foreground">没有匹配的设置</p>
      </div>
    </div>
  );
}

function AdvancedSettingsFooter() {
  const search = useSettingsSearch();

  return (
    <AdvancedSettingsFooterContent
      hasActiveFilters={search.hasActiveFilters}
      isAdvancedVisible={search.isAdvancedVisible}
      onToggleShowAdvanced={search.toggleShowAdvanced}
    />
  );
}
