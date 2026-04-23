import { SettingsSectionModeProvider } from "@renderer/components/settings/SettingsSectionModeContext";
import { buildSitePrioritySummary } from "@renderer/components/settings/SitePriorityEditorField";
import {
  AssetDownloadsSection,
  buildNamingPreviewConfig,
  NAMING_TEMPLATE_DESCRIPTION,
  NamingSection,
  PersonSyncSharedSection,
} from "@renderer/components/settings/settingsContent";
import {
  FileBehaviorTopLevelSection,
  NetworkTopLevelSection,
  TranslateTopLevelSection,
} from "@renderer/components/settings/TopLevelSections";
import { SettingsEditorAutosaveProvider } from "@renderer/hooks/useAutoSaveField";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type FieldValues, FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

function NamingSectionHarness() {
  const savedValues = {
    "naming.folderTemplate": "{actor}/{number}",
    "naming.fileTemplate": "{number}",
  };
  const form = useForm<FieldValues>({
    defaultValues: {
      naming: {
        folderTemplate: "{actor}/{number}",
        fileTemplate: "{number}",
      },
    },
  });

  return createElement(
    FormProvider,
    form as ComponentProps<typeof FormProvider>,
    createElement(
      SettingsEditorAutosaveProvider,
      {
        savedValues,
        defaultValues: savedValues,
        defaultValuesReady: true,
      },
      createElement(NamingSection),
    ),
  );
}

function AdvancedNamingSectionHarness() {
  const savedValues = {
    "naming.releaseRule": "yyyy-MM-dd",
  };
  const form = useForm<FieldValues>({
    defaultValues: {
      naming: {
        releaseRule: "yyyy-MM-dd",
      },
    },
  });

  return createElement(
    FormProvider,
    form as ComponentProps<typeof FormProvider>,
    createElement(
      SettingsEditorAutosaveProvider,
      {
        savedValues,
        defaultValues: savedValues,
        defaultValuesReady: true,
      },
      createElement(SettingsSectionModeProvider, { mode: "advanced" }, createElement(NamingSection)),
    ),
  );
}

function AdvancedAssetDownloadsHarness() {
  const savedValues = {
    "download.downloadPoster": true,
    "download.sceneImageConcurrency": 4,
  };
  const form = useForm<FieldValues>({
    defaultValues: {
      download: {
        downloadPoster: true,
        sceneImageConcurrency: 4,
      },
    },
  });

  return createElement(
    FormProvider,
    form as ComponentProps<typeof FormProvider>,
    createElement(
      SettingsEditorAutosaveProvider,
      {
        savedValues,
        defaultValues: savedValues,
        defaultValuesReady: true,
      },
      createElement(SettingsSectionModeProvider, { mode: "advanced" }, createElement(AssetDownloadsSection)),
    ),
  );
}

function PersonSyncHarness({ mode }: { mode: "public" | "advanced" }) {
  const savedValues = {
    "personSync.personOverviewSources": ["official"],
    "personSync.personImageSources": ["official"],
  };
  const form = useForm<FieldValues>({
    defaultValues: {
      personSync: {
        personOverviewSources: ["official"],
        personImageSources: ["official"],
      },
    },
  });

  return createElement(
    FormProvider,
    form as ComponentProps<typeof FormProvider>,
    createElement(
      SettingsEditorAutosaveProvider,
      {
        savedValues,
        defaultValues: savedValues,
        defaultValuesReady: true,
      },
      createElement(SettingsSectionModeProvider, { mode }, createElement(PersonSyncSharedSection)),
    ),
  );
}

function SettingsSectionHarness({ section }: { section: "network" | "translate" | "fileBehavior" }) {
  const savedValues = {
    "network.proxyType": "none",
    "network.proxy": "",
    "network.useProxy": false,
    "network.timeout": 30,
    "network.retryCount": 3,
    "network.javdbCookie": "",
    "network.javbusCookie": "",
    "translate.enableTranslation": false,
    "translate.engine": "google",
    "translate.targetLanguage": "zh-CN",
    "behavior.successFileMove": false,
    "behavior.failedFileMove": false,
    "behavior.successFileRename": false,
    "behavior.deleteEmptyFolder": false,
    "behavior.scrapeSoftlinkPath": false,
    "behavior.saveLog": false,
  };
  const form = useForm<FieldValues>({
    defaultValues: savedValues,
  });
  const sectionElement =
    section === "network"
      ? createElement(NetworkTopLevelSection, { forceOpen: true })
      : section === "translate"
        ? createElement(TranslateTopLevelSection, { forceOpen: true })
        : createElement(FileBehaviorTopLevelSection, { forceOpen: true });

  return createElement(
    FormProvider,
    form as ComponentProps<typeof FormProvider>,
    createElement(
      SettingsEditorAutosaveProvider,
      {
        savedValues,
        defaultValues: savedValues,
        defaultValuesReady: true,
      },
      sectionElement,
    ),
  );
}

describe("settingsContent", () => {
  it("renders naming template placeholder help for both template fields", () => {
    const html = renderToStaticMarkup(createElement(NamingSectionHarness));

    expect(html.split(NAMING_TEMPLATE_DESCRIPTION)).toHaveLength(3);
  });

  it("does not move previously public naming rows into the advanced section", () => {
    const html = renderToStaticMarkup(createElement(AdvancedNamingSectionHarness));

    expect(html).toBe("");
  });

  it("renders only genuinely advanced download rows inside the advanced section", () => {
    const html = renderToStaticMarkup(createElement(AdvancedAssetDownloadsHarness));

    expect(html).toContain("剧照下载并发");
    expect(html).not.toContain("下载海报");
  });

  it("keeps shared person-sync chrome in public mode and out of the advanced section", () => {
    const publicHtml = renderToStaticMarkup(createElement(PersonSyncHarness, { mode: "public" }));
    const advancedHtml = renderToStaticMarkup(createElement(PersonSyncHarness, { mode: "advanced" }));

    expect(publicHtml).toContain("共享人物资料源");
    expect(advancedHtml).toBe("");
  });

  it("renders split top-level sections for network, translation, and file behavior", () => {
    const networkHtml = renderToStaticMarkup(createElement(SettingsSectionHarness, { section: "network" }));
    const translateHtml = renderToStaticMarkup(createElement(SettingsSectionHarness, { section: "translate" }));
    const behaviorHtml = renderToStaticMarkup(createElement(SettingsSectionHarness, { section: "fileBehavior" }));

    expect(networkHtml).toContain("网络连接");
    expect(networkHtml).toContain("代理类型");
    expect(networkHtml).toContain("JavDB Cookie");
    expect(translateHtml).toContain("翻译服务");
    expect(translateHtml).toContain("翻译引擎");
    expect(behaviorHtml).toContain("文件行为");
    expect(behaviorHtml).toContain("成功后移动文件");
  });

  it("builds nested naming preview config from flat form field values", () => {
    expect(
      buildNamingPreviewConfig({
        "naming.folderTemplate": "{actorFallbackPrefix}{actor}/{number}",
        "naming.fileTemplate": "{number}{originaltitle}",
        "naming.actorFallbackToStudio": true,
        "behavior.successFileMove": true,
        "behavior.successFileRename": true,
      }),
    ).toMatchObject({
      naming: {
        folderTemplate: "{actorFallbackPrefix}{actor}/{number}",
        fileTemplate: "{number}{originaltitle}",
        actorFallbackToStudio: true,
      },
      behavior: {
        successFileMove: true,
        successFileRename: true,
      },
    });
  });

  it("summarizes enabled site priority for the compact editor row", () => {
    expect(
      buildSitePrioritySummary(["dmm", "dmm_tv", "mgstage", "dmm"], ["dmm", "dmm_tv", "mgstage", "faleno"]),
    ).toMatchObject({
      enabledCount: 3,
      totalCount: 4,
      preview: ["dmm", "dmm_tv", "mgstage"],
      remainingCount: 0,
    });

    expect(
      buildSitePrioritySummary(
        ["dmm", "dmm_tv", "mgstage", "prestige"],
        ["dmm", "dmm_tv", "mgstage", "prestige", "faleno"],
      ),
    ).toMatchObject({
      enabledCount: 4,
      totalCount: 5,
      preview: ["dmm", "dmm_tv", "mgstage"],
      remainingCount: 1,
    });
  });
});
