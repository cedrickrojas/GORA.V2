import type { ClubForm } from "@/types/club";

export interface ClubDescriptionDraft {
  description: string;
  about: string;
}

const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const fit = (value: string, max: number) =>
  value.length <= max
    ? value
    : value
        .slice(0, max - 1)
        .replace(/\s+\S*$/, "")
        .trimEnd() + ".";

/** A factual draft from the entered club details; no API key or external AI required. */
export function generateClubDescription(
  form: ClubForm,
  sportName = "",
  language: "en" | "fil" = "en",
): ClubDescriptionDraft {
  const name =
    clean(form.name) || (language === "fil" ? "Ang aming club" : "Our club");
  const sport = clean(sportName);
  const city = clean(form.city);
  const venue = clean(form.homeCourt);
  if (language === "fil") {
    return {
      description: fit(
        `${name}: samahan para sa ${sport || "sports"}${city ? ` sa ${city}` : ""}. Maglaro, makipagkilala, at umangat kasama ang iyong crew.`,
        160,
      ),
      about: `Maligayang pagdating sa ${name}! Magkakilala at maglaro kasama ang mga mahilig sa ${sport || "sports"}${city ? ` sa ${city}` : ""}. Magplano ng mga laro at magbahagi ng mga karanasan bilang isang komunidad.${venue ? ` Ang aming home venue ay ${venue}.` : ""} ${form.membershipType === "INVITE_ONLY" ? "Kailangan ng imbitasyon para sumali." : form.membershipType === "APPROVAL_REQUIRED" ? "Magpadala ng request para ma-review ng mga club admin." : "Maaaring sumali habang may bakanteng slot."}`,
    };
  }
  return {
    description: fit(
      `${name} brings ${sport ? sport.toLowerCase() + " players" : "sports enthusiasts"} together${city ? ` in ${city}` : ""}. Play, connect, and grow with your crew.`,
      160,
    ),
    about: `Welcome to ${name}! Connect with fellow ${sport ? sport.toLowerCase() + " players" : "sports enthusiasts"}${city ? ` in ${city}` : ""}, coordinate games, and share your game-day moments.${venue ? ` Our home venue is ${venue}.` : ""} ${form.membershipType === "INVITE_ONLY" ? "Membership is by invitation." : form.membershipType === "APPROVAL_REQUIRED" ? "Send a join request for the club admins to review." : "Join while spots are available and find your next crew."}`,
  };
}

/** Continue updating generated text as details change; preserve the person's own edits. */
export function applyGeneratedClubDescription(
  form: ClubForm,
  next: ClubDescriptionDraft,
  previous: ClubDescriptionDraft | null,
): ClubDescriptionDraft {
  for (const field of ["description", "about"] as const) {
    if (!form[field].trim() || form[field] === previous?.[field])
      form[field] = next[field];
  }
  return next;
}
