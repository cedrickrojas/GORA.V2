import { describe, expect, it } from "vitest";
import {
  applyGeneratedClubDescription,
  generateClubDescription,
} from "@/utils/club-description";
import {
  emptyClubForm,
  toClubCreateInput,
  toClubUpdateInput,
  validateClubForm,
} from "@/utils/club-form";

const form = () => ({
  ...emptyClubForm(),
  name: "Manila Hoops",
  username: "manila-hoops",
  primarySportId: "sport-1",
  city: "Manila",
  homeCourt: "Central Court",
});

describe("Generated club text", () => {
  it("uses the entered name, sport, place and membership without inventing details", () => {
    const draft = generateClubDescription(
      { ...form(), membershipType: "APPROVAL_REQUIRED" },
      "Basketball",
    );
    expect(draft.description).toContain("Manila Hoops");
    expect(draft.description).toContain("basketball");
    expect(draft.description).toContain("Manila");
    expect(draft.about).toContain("Central Court");
    expect(draft.about).toContain("review");
    expect(draft.description.length).toBeLessThanOrEqual(160);
    expect(draft.about).not.toMatch(/every level|professional|Sunday|free/i);
  });
  it("updates the generated draft as details change, preserving manual edits", () => {
    const value = form();
    const initial = applyGeneratedClubDescription(
      value,
      generateClubDescription(value),
      null,
    );
    value.city = "Pasig";
    const next = applyGeneratedClubDescription(
      value,
      generateClubDescription(value, "Tennis"),
      initial,
    );
    expect(value.description).toContain("tennis");
    value.description = "My own club description.";
    value.about = "Our own rules and goals.";
    value.city = "Makati";
    applyGeneratedClubDescription(
      value,
      generateClubDescription(value, "Football"),
      next,
    );
    expect(value.description).toBe("My own club description.");
    expect(value.about).toBe("Our own rules and goals.");
  });
  it("supports Filipino and keeps long input within the short-description limit", () => {
    const draft = generateClubDescription(
      {
        ...form(),
        name: "A".repeat(80),
        city: "B".repeat(80),
        membershipType: "INVITE_ONLY",
      },
      "Basketball",
      "fil",
    );
    expect(draft.description.length).toBeLessThanOrEqual(160);
    expect(draft.about).toContain("imbitasyon");
    expect(draft.about.length).toBeLessThanOrEqual(2000);
  });
});

describe("Club photo form serialization", () => {
  const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
  const stored =
    "/api/v1/clubs/11111111-1111-4111-8111-111111111111/photos/profile/22222222-2222-4222-8222-222222222222";
  it("sends uploaded data as a photo payload, not as a URL", () => {
    const value = {
      ...form(),
      description: "A local club.",
      profileImageUrl: photo,
      coverImageUrl: photo,
    };
    expect(validateClubForm(value).profileImageUrl).toBeUndefined();
    expect(toClubCreateInput(value)).toMatchObject({
      profilePhoto: photo,
      coverPhoto: photo,
    });
    expect(toClubCreateInput(value).profileImageUrl).toBeUndefined();
  });
  it("preserves stored photos when editing text, and explicitly removes them when cleared", () => {
    const original = {
      ...form(),
      description: "A local club.",
      profileImageUrl: stored,
    };
    expect(validateClubForm(original).profileImageUrl).toBeUndefined();
    expect(
      toClubUpdateInput({ ...original, about: "Updated." }, original),
    ).toEqual({ about: "Updated." });
    expect(
      toClubUpdateInput({ ...original, profileImageUrl: "" }, original),
    ).toMatchObject({ profileImageUrl: null });
    expect(
      toClubCreateInput({
        ...original,
        profileImageUrl: "https://gora.example" + stored,
      }).profileImageUrl,
    ).toBeUndefined();
  });
  it("rejects unsupported payloads and never allows photo data in website links", () => {
    expect(
      validateClubForm({
        ...form(),
        profileImageUrl: "data:image/svg+xml;base64,PHN2Zz4=",
      }).profileImageUrl,
    ).toBeTruthy();
    expect(
      validateClubForm({ ...form(), websiteUrl: photo }).websiteUrl,
    ).toBeTruthy();
  });
});
