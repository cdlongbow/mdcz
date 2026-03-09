import { hasMissingActorInfo, planPersonSync } from "@main/services/personSync/planner";
import { describe, expect, it } from "vitest";

describe("person sync planner", () => {
  it("fills missing actor tags and summary without overwriting an existing overview", () => {
    const result = planPersonSync(
      {
        name: "神木麗",
        description: "官方简介",
        birth_date: "1999-12-20",
        birth_place: "埼玉県",
        blood_type: "A",
        height_cm: 169,
        bust_cm: 95,
        waist_cm: 60,
        hip_cm: 85,
        cup_size: "G",
      },
      {
        overview: "已有简介",
        tags: ["favorite"],
        taglines: [],
      },
      "missing",
    );

    expect(result.shouldUpdate).toBe(true);
    expect(result.updatedFields).toEqual(["tags", "taglines"]);
    expect(result.overview).toBe("已有简介");
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "favorite",
        "mdcz:birth_date:1999-12-20",
        "mdcz:birth_place:埼玉県",
        "mdcz:blood_type:A",
        "mdcz:height_cm:169",
      ]),
    );
    expect(result.taglines).toEqual(["MDCz: 1999-12-20 / 埼玉県 / A型 / 169cm / B95 W60 H85 / Gカップ"]);
  });

  it("refreshes managed fields in all mode while preserving user tags and user taglines", () => {
    const result = planPersonSync(
      {
        name: "神木麗",
        description: "官方简介",
        birth_date: "1999-12-20",
        birth_place: "埼玉県",
        blood_type: "A",
        height_cm: 169,
      },
      {
        overview: "旧简介",
        tags: ["favorite", "mdcz:height_cm:160"],
        taglines: ["常驻收藏", "MDCz: 160cm"],
      },
      "all",
    );

    expect(result.shouldUpdate).toBe(true);
    expect(result.updatedFields).toEqual(["overview", "tags", "taglines"]);
    expect(result.overview).toBe("官方简介");
    expect(result.tags).toEqual(
      expect.arrayContaining(["favorite", "mdcz:birth_date:1999-12-20", "mdcz:height_cm:169"]),
    );
    expect(result.tags).not.toContain("mdcz:height_cm:160");
    expect(result.taglines).toEqual(["常驻收藏", "MDCz: 1999-12-20 / 埼玉県 / A型 / 169cm"]);
  });

  it("detects whether actor info is still missing", () => {
    expect(
      hasMissingActorInfo({
        overview: "已有简介",
        tags: ["favorite", "mdcz:birth_date:1999-12-20"],
        taglines: ["MDCz: 1999-12-20"],
      }),
    ).toBe(false);

    expect(
      hasMissingActorInfo({
        overview: "已有简介",
        tags: ["favorite"],
        taglines: [],
      }),
    ).toBe(true);
  });
});
