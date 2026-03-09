import {
  buildActorManagedTagline,
  buildActorManagedTags,
  isActorManagedTag,
  isActorManagedTagline,
  mergeActorProfiles,
  parseActorManagedTags,
} from "@main/utils/actorProfile";
import type { ActorProfile } from "@shared/types";

export type PersonSyncMode = "all" | "missing";
export type PersonSyncField = "overview" | "tags" | "taglines";

export interface ExistingPersonSyncState {
  overview?: string;
  tags?: string[];
  taglines?: string[];
}

export interface PlannedPersonSyncState {
  shouldUpdate: boolean;
  updatedFields: PersonSyncField[];
  overview?: string;
  tags: string[];
  taglines: string[];
}

const toTrimmedString = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const toStringArray = (value: string[] | undefined): string[] => {
  return value?.filter((entry) => typeof entry === "string" && entry.trim().length > 0) ?? [];
};

const toNamedProfile = (name: string, partial: Partial<ActorProfile>): ActorProfile => ({
  name,
  ...partial,
});

const toCanonicalManagedProfile = (
  sourceProfile: ActorProfile,
  tags: string[],
  mode: PersonSyncMode,
): ActorProfile | null => {
  const existingManagedProfile = toNamedProfile(sourceProfile.name, parseActorManagedTags(tags));
  return mode === "all"
    ? mergeActorProfiles([sourceProfile, existingManagedProfile])
    : mergeActorProfiles([existingManagedProfile, sourceProfile]);
};

const haveSameTagMembers = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const entry of leftSet) {
    if (!rightSet.has(entry)) {
      return false;
    }
  }

  return true;
};

const haveSameTaglineOrder = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
};

export const hasManagedActorTags = (tags: string[] | undefined): boolean => {
  return toStringArray(tags).some(isActorManagedTag);
};

export const hasManagedActorSummary = (taglines: string[] | undefined): boolean => {
  return toStringArray(taglines).some(isActorManagedTagline);
};

export const hasMissingActorInfo = (existing: ExistingPersonSyncState): boolean => {
  return (
    !toTrimmedString(existing.overview) ||
    !hasManagedActorTags(existing.tags) ||
    !hasManagedActorSummary(existing.taglines)
  );
};

export const planPersonSync = (
  sourceProfile: ActorProfile,
  existing: ExistingPersonSyncState,
  mode: PersonSyncMode,
): PlannedPersonSyncState => {
  const currentOverview = toTrimmedString(existing.overview);
  const currentTags = toStringArray(existing.tags);
  const currentTaglines = toStringArray(existing.taglines);
  const retainedTags = currentTags.filter((tag) => !isActorManagedTag(tag));
  const retainedTaglines = currentTaglines.filter((tagline) => !isActorManagedTagline(tagline));
  const sourceOverview = toTrimmedString(sourceProfile.description);
  const managedProfile = toCanonicalManagedProfile(sourceProfile, currentTags, mode);
  const managedTags = managedProfile ? buildActorManagedTags(managedProfile) : [];
  const managedTagline = managedProfile ? buildActorManagedTagline(managedProfile) : undefined;

  const overview = mode === "all" ? (sourceOverview ?? currentOverview) : (currentOverview ?? sourceOverview);
  const tags = mode === "missing" && hasManagedActorTags(currentTags) ? currentTags : [...retainedTags, ...managedTags];
  const taglines =
    mode === "missing" && hasManagedActorSummary(currentTaglines)
      ? currentTaglines
      : managedTagline
        ? [...retainedTaglines, managedTagline]
        : currentTaglines;

  const updatedFields: PersonSyncField[] = [];
  if (overview !== currentOverview) {
    updatedFields.push("overview");
  }
  if (!haveSameTagMembers(tags, currentTags)) {
    updatedFields.push("tags");
  }
  if (!haveSameTaglineOrder(taglines, currentTaglines)) {
    updatedFields.push("taglines");
  }

  return {
    shouldUpdate: updatedFields.length > 0,
    updatedFields,
    overview,
    tags,
    taglines,
  };
};
