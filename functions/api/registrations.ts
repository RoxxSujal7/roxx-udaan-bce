// Cloudflare Pages Function: POST /api/registrations
// Validates UDAAN 2026 event registration submissions and persists them to Supabase PostgreSQL.

import {
  getSupabaseConfig,
  logSupabaseError,
  supabaseFetch,
} from "../../lib/server/supabase-rest";

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const ALLOWED_EVENTS = new Set<string>([
  "Cricket",
  "Football",
  "Badminton",
  "Table Tennis",
  "Volleyball",
  "Athletics",
  "Board Games",
  "Javelin",
  "Kabaddi",
  "Tug of War",
  "Literary",
  "Cultural",
  "BGMI",
  "Free Fire",
  "Valorant",
]);

const TEAM_APPLICABLE_EVENTS = new Set<string>([
  "Cricket",
  "Football",
  "Volleyball",
  "Kabaddi",
  "Tug of War",
  "Badminton",
  "Table Tennis",
  "BGMI",
  "Free Fire",
  "Valorant",
]);

const TEAM_REQUIRED_EVENTS = new Set<string>([
  "BGMI",
  "Free Fire",
  "Valorant",
]);

const ALLOWED_DEPARTMENTS = new Set<string>([
  "CSE",
  "ECE",
  "EE",
  "ME",
  "CE",
  "Other",
]);

const ALLOWED_YEARS = new Set<string>([
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "PG / Other",
]);

const FIXED_COLLEGE = "Bhagalpur College of Engineering";
const ROLL_NUMBER_REGEX = /^\d{3,40}$/;
const MAX_TEAM_MEMBERS = 15;
const MAX_BODY_BYTES = 16 * 1024;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanOptionalText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export function normalizeAndValidatePhone(
  _rawCountryCode: unknown,
  rawPhone: unknown,
): { ok: true; normalized: string } | { ok: false; error: string } {
  if (typeof rawPhone !== "string") {
    return { ok: false, error: "Mobile number is required." };
  }

  let digits = rawPhone.replace(/\D/g, "");
  // Strip leading 0 or 91 if pasted with national/country prefix
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return {
      ok: false,
      error: "Please enter a valid 10-digit Indian mobile number (+91).",
    };
  }
  return { ok: true, normalized: `+91${digits}` };
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { ok: false, error: "Content-Type must be application/json." },
      415,
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, error: "Request payload exceeds maximum allowed size." },
      413,
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Malformed JSON payload." }, 400);
  }

  // Honeypot check
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return jsonResponse({ ok: false, error: "Invalid submission." }, 400);
  }

  const submissionId =
    typeof body.submissionId === "string" ? body.submissionId.trim() : "";
  if (!UUID_REGEX.test(submissionId)) {
    return jsonResponse(
      { ok: false, error: "Missing or invalid submission identifier." },
      400,
    );
  }

  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (fullName.length < 2 || fullName.length > 120) {
    return jsonResponse(
      { ok: false, error: "Full name must be between 2 and 120 characters." },
      400,
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_REGEX.test(email) || email.length > 160) {
    return jsonResponse(
      { ok: false, error: "Please provide a valid email address." },
      400,
    );
  }

  const phoneResult = normalizeAndValidatePhone(
    body.phoneCountryCode,
    body.phone,
  );
  if (!phoneResult.ok) {
    return jsonResponse({ ok: false, error: phoneResult.error }, 400);
  }

  const college = FIXED_COLLEGE;

  const rollNumber =
    typeof body.rollNumber === "string" ? body.rollNumber.trim() : "";
  if (!ROLL_NUMBER_REGEX.test(rollNumber)) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Roll / Registration number is required (3–40 digits only).",
      },
      400,
    );
  }

  const department =
    typeof body.department === "string" ? body.department.trim() : "";
  if (!ALLOWED_DEPARTMENTS.has(department)) {
    return jsonResponse(
      { ok: false, error: "Please select a valid department / branch." },
      400,
    );
  }

  const academicYear =
    typeof body.academicYear === "string" ? body.academicYear.trim() : "";
  if (!ALLOWED_YEARS.has(academicYear)) {
    return jsonResponse(
      { ok: false, error: "Please select a valid academic year." },
      400,
    );
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return jsonResponse(
      { ok: false, error: "Please select at least one valid event." },
      400,
    );
  }

  const uniqueEvents = Array.from(
    new Set(
      body.events.filter((e): e is string => typeof e === "string").map((e) => e.trim()),
    ),
  );
  if (
    uniqueEvents.length === 0 ||
    uniqueEvents.length > ALLOWED_EVENTS.size ||
    uniqueEvents.some((ev) => !ALLOWED_EVENTS.has(ev))
  ) {
    return jsonResponse(
      { ok: false, error: "One or more selected events are not recognized." },
      400,
    );
  }

  const hasTeamApplicable = uniqueEvents.some((ev) =>
    TEAM_APPLICABLE_EVENTS.has(ev),
  );
  const hasTeamRequired = uniqueEvents.some((ev) =>
    TEAM_REQUIRED_EVENTS.has(ev),
  );
  if (hasTeamRequired && body.participationType !== "team") {
    return jsonResponse(
      { ok: false, error: "Team entry is required for IGNITION esports events." },
      400,
    );
  }
  const participationType =
    hasTeamApplicable && body.participationType === "team"
      ? "team"
      : "individual";

  const teamName =
    participationType === "team" ? cleanOptionalText(body.teamName, 100) : null;
  if (participationType === "team" && (!teamName || teamName.length < 2)) {
    return jsonResponse(
      { ok: false, error: "Team name is required for team entries." },
      400,
    );
  }

  let teamMembers: string | null = null;
  if (participationType === "team") {
    if (!Array.isArray(body.teamMemberDetails)) {
      return jsonResponse(
        { ok: false, error: "Team member details are required for team entries." },
        400,
      );
    }
    if (
      body.teamMemberDetails.length < 1 ||
      body.teamMemberDetails.length > MAX_TEAM_MEMBERS
    ) {
      return jsonResponse(
        {
          ok: false,
          error: `Team entries require between 1 and ${MAX_TEAM_MEMBERS} teammates.`,
        },
        400,
      );
    }

    const seenRolls = new Set<string>([rollNumber.toLowerCase()]);
    const formattedMembers: string[] = [];

    for (let i = 0; i < body.teamMemberDetails.length; i++) {
      const rawMember = body.teamMemberDetails[i];
      if (!rawMember || typeof rawMember !== "object" || Array.isArray(rawMember)) {
        return jsonResponse(
          { ok: false, error: `Teammate ${i + 1}: invalid member entry.` },
          400,
        );
      }
      const m = rawMember as Record<string, unknown>;
      const mName = typeof m.name === "string" ? m.name.trim() : "";
      if (mName.length < 2 || mName.length > 120) {
        return jsonResponse(
          {
            ok: false,
            error: `Teammate ${i + 1}: full name must be 2–120 characters.`,
          },
          400,
        );
      }
      const mRoll = typeof m.rollNumber === "string" ? m.rollNumber.trim() : "";
      if (!ROLL_NUMBER_REGEX.test(mRoll)) {
        return jsonResponse(
          {
            ok: false,
            error: `Teammate ${i + 1}: registration number must be 3–40 digits only.`,
          },
          400,
        );
      }
      const mRollKey = mRoll.toLowerCase();
      if (mRollKey === rollNumber.toLowerCase()) {
        return jsonResponse(
          {
            ok: false,
            error: `Teammate ${i + 1}: registration number cannot match your own roll number.`,
          },
          400,
        );
      }
      if (seenRolls.has(mRollKey)) {
        return jsonResponse(
          {
            ok: false,
            error: `Teammate ${i + 1}: duplicate registration number (${mRoll}).`,
          },
          400,
        );
      }
      seenRolls.add(mRollKey);

      const mDept = typeof m.department === "string" ? m.department.trim() : "";
      if (!ALLOWED_DEPARTMENTS.has(mDept)) {
        return jsonResponse(
          { ok: false, error: `Teammate ${i + 1}: please select a valid branch.` },
          400,
        );
      }
      const mYear = typeof m.academicYear === "string" ? m.academicYear.trim() : "";
      if (!ALLOWED_YEARS.has(mYear)) {
        return jsonResponse(
          { ok: false, error: `Teammate ${i + 1}: please select a valid year.` },
          400,
        );
      }

      formattedMembers.push(`${mName} — ${mRoll} — ${mDept} — ${mYear}`);
    }

    teamMembers = formattedMembers.join("\n");
  }

  const notes = cleanOptionalText(body.notes, 500);
  if (body.confirmedDetails !== true) {
    return jsonResponse(
      { ok: false, error: "You must confirm accuracy and event rules to submit." },
      400,
    );
  }
  if (participationType === "team" && body.teamConfirmed !== true) {
    return jsonResponse(
      {
        ok: false,
        error:
          "You must confirm all team members have agreed to participate and their details are correct.",
      },
      400,
    );
  }

  const cfg = getSupabaseConfig(env);
  if (!cfg) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Registration backend is not yet configured on the server. Please configure SUPABASE_URL and SUPABASE_SECRET_KEY.",
      },
      503,
    );
  }

  const record = {
    submission_id: submissionId,
    full_name: fullName,
    email,
    phone: phoneResult.normalized,
    college,
    roll_number: rollNumber,
    department,
    academic_year: academicYear,
    events: uniqueEvents,
    participation_type: participationType,
    team_name: teamName,
    team_members: teamMembers,
    notes,
    confirmed_details: true,
    status: "submitted",
  };

  const supabaseResponse = await supabaseFetch(cfg, "event_registrations", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });

  if (supabaseResponse.status === 409) {
    // Idempotent duplicate submission_id handling: fetch existing registration id
    const lookup = await supabaseFetch(
      cfg,
      `event_registrations?submission_id=eq.${encodeURIComponent(submissionId)}&select=id,created_at`,
    );
    if (lookup.ok) {
      const existing = (await lookup.json()) as Array<{
        id: string;
        created_at: string;
      }>;
      if (existing[0]?.id) {
        return jsonResponse(
          {
            ok: true,
            registrationId: existing[0].id,
            createdAt: existing[0].created_at,
            deduplicated: true,
          },
          200,
        );
      }
    } else {
      await logSupabaseError("POST /api/registrations (dedup lookup)", lookup);
    }
    return jsonResponse(
      { ok: false, error: "Duplicate submission detected." },
      409,
    );
  }

  if (!supabaseResponse.ok) {
    await logSupabaseError("POST /api/registrations", supabaseResponse);
    return jsonResponse(
      {
        ok: false,
        error: "Unable to save registration in database. Please try again.",
      },
      502,
    );
  }

  const inserted = (await supabaseResponse.json()) as Array<{
    id: string;
    created_at: string;
  }>;
  if (!inserted[0]?.id) {
    return jsonResponse(
      { ok: false, error: "Database did not return a registration ID." },
      502,
    );
  }

  return jsonResponse(
    {
      ok: true,
      registrationId: inserted[0].id,
      createdAt: inserted[0].created_at,
    },
    201,
  );
}
