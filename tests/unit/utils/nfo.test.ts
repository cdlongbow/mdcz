import { NfoGenerator } from "@main/services/scraper/NfoGenerator";
import { parseNfo } from "@main/utils/nfo";
import { Website } from "@shared/enums";
import { describe, expect, it } from "vitest";

describe("parseNfo", () => {
  it("reads poster, thumb, and fanart by aspect", () => {
    const xml = `
      <movie>
        <title>中文标题</title>
        <originaltitle>Original Title</originaltitle>
        <website>${Website.JAVDB}</website>
        <uniqueid type="${Website.JAVDB}">ABC-123</uniqueid>
        <thumb aspect="poster">poster.jpg</thumb>
        <thumb aspect="thumb">thumb.jpg</thumb>
        <fanart>
          <thumb>fanart.jpg</thumb>
        </fanart>
      </movie>
    `;

    const result = parseNfo(xml);

    expect(result.title).toBe("Original Title");
    expect(result.title_zh).toBe("中文标题");
    expect(result.thumb_url).toBe("thumb.jpg");
    expect(result.poster_url).toBe("poster.jpg");
    expect(result.fanart_url).toBe("fanart.jpg");
  });

  it("falls back to the first aspectless thumb", () => {
    const xml = `
      <movie>
        <title>Only Thumb</title>
        <website>${Website.JAVBUS}</website>
        <uniqueid type="${Website.JAVBUS}">DEF-456</uniqueid>
        <thumb>https://example.com/thumb.jpg</thumb>
      </movie>
    `;

    const result = parseNfo(xml);

    expect(result.thumb_url).toBe("https://example.com/thumb.jpg");
    expect(result.poster_url).toBeUndefined();
  });

  it("round-trips structured actor profile fields", () => {
    const xml = new NfoGenerator().buildXml({
      title: "Sample",
      number: "ABC-123",
      actors: ["Actor A"],
      actor_profiles: [
        {
          name: "Actor A",
          birth_date: "2001-02-03",
          birth_place: "東京都",
          blood_type: "A",
          description: "Actor biography",
          height_cm: 160,
          bust_cm: 90,
          waist_cm: 58,
          hip_cm: 88,
          cup_size: "G",
          photo_url: "actor-a.jpg",
        },
      ],
      genres: [],
      sample_images: [],
      website: Website.DMM,
    });

    const parsed = parseNfo(xml);
    expect(parsed.actor_profiles?.[0]).toMatchObject({
      name: "Actor A",
      birth_date: "2001-02-03",
      birth_place: "東京都",
      blood_type: "A",
      description: "Actor biography",
      height_cm: 160,
      bust_cm: 90,
      waist_cm: 58,
      hip_cm: 88,
      cup_size: "G",
      photo_url: "actor-a.jpg",
    });
  });
});
