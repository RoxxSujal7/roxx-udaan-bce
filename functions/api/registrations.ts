// Cloudflare Pages Function: POST /api/registrations
// Validates UDAAN 2026 event registration submissions and persists them to Supabase PostgreSQL.

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
  rawCountryCode: unknown,
  rawPhone: unknown,
): { ok: true; normalized: string } | { ok: false; error: string } {
  if (typeof rawPhone !== "string") {
    return { ok: false, error: "Mobile number is required." };
  }
  const code =
    typeof rawCountryCode === "string" && rawCountryCode.trim()
      ? rawCountryCode.trim()
      : "+91";

  if (!/^\+[1-9]\d{0,3}$/.test(code)) {
    return { ok: false, error: "Please enter a valid country code (e.g. +91)." };
  }

  let digits = rawPhone.replace(/\D/g, "");
  if (code === "+91") {
    // Strip leading 0 or 91 if pasted with national/country prefix
    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    } else if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        ok: false,
        error: "Please enter a valid 10-digit Indian mobile number.",
      };
    }
    return { ok: true, normalized: `+91${digits}` };
  }

  if (digits.length < 6 || digits.length > 14) {
    return {
      ok: false,
      error: "Please enter a valid international phone number.",
    };
  }
  const e164 = `${code}${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    return {
      ok: false,
      error: "Please enter a valid international phone number.",
    };
  }
  return { ok: true, normalized: e164 };
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

  const college = typeof body.college === "string" ? body.college.trim() : "";
  if (college.length < 2 || college.length > 160) {
    return jsonResponse(
      {
        ok: false,
        error: "College or institution must be between 2 and 160 characters.",
      },
      400,
    );
  }

  const rollNumber = cleanOptionalText(body.rollNumber, 40);
  const department = cleanOptionalText(body.department, 40);
  if (department && !ALLOWED_DEPARTMENTS.has(department)) {
    return jsonResponse({ ok: false, error: "Invalid department value." }, 400);
  }

  const academicYear = cleanOptionalText(body.academicYear, 30);
  if (academicYear && !ALLOWED_YEARS.has(academicYear)) {
    return jsonResponse(
      { ok: false, error: "Invalid academic year value." },
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

  const teamMembers =
    participationType === "team"
      ? cleanOptionalText(body.teamMembers, 500)
      : null;

  const notes = cleanOptionalText(body.notes, 500);
  if (body.confirmedDetails !== true) {
    return jsonResponse(
      { ok: false, error: "You must confirm accuracy and consent to submit." },
      400,
    );
  }

  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseSecretKey) {
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

  const supabaseResponse = await fetch(
    `${supabaseUrl}/rest/v1/event_registrations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(record),
    },
  );

  if (supabaseResponse.status === 409) {
    // Idempotent duplicate submission_id handling: fetch existing registration id
    const lookup = await fetch(
      `${supabaseUrl}/rest/v1/event_registrations?submission_id=eq.${encodeURIComponent(submissionId)}&select=id,created_at`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      },
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
    }
    return jsonResponse(
      { ok: false, error: "Duplicate submission detected." },
      409,
    );
  }

  if (!supabaseResponse.ok) {
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
