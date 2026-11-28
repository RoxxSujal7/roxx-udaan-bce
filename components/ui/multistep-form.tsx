"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  ALL_ALLOWED_EVENTS,
  IGNITION_ESPORTS_EVENTS,
  UDAAN_SPORTS_AND_CULTURAL_EVENTS,
} from "@/lib/events";

export {
  ALL_ALLOWED_EVENTS,
  IGNITION_ESPORTS_EVENTS,
  UDAAN_SPORTS_AND_CULTURAL_EVENTS,
};

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

const TEAM_REQUIRED_EVENTS = new Set<string>(IGNITION_ESPORTS_EVENTS);

const steps = [
  { id: "participant", title: "Participant" },
  { id: "academic", title: "Academic" },
  { id: "events", title: "Events" },
  { id: "team", title: "Team" },
  { id: "additional", title: "Notes" },
  { id: "review", title: "Review" },
];

export interface TeamMemberDetail {
  name: string;
  rollNumber: string;
  department: string;
  academicYear: string;
}

export interface RegistrationFormData {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  college: string;
  rollNumber: string;
  department: string;
  academicYear: string;
  events: string[];
  participationType: "individual" | "team";
  teamName: string;
  teamMemberDetails: TeamMemberDetail[];
  notes: string;
  confirmedDetails: boolean;
  teamConfirmed: boolean;
  website: string; // Honeypot field (must remain empty)
}

const FIXED_COLLEGE = "Bhagalpur College of Engineering";
const ROLL_NUMBER_REGEX = /^\d{3,40}$/;
const MAX_TEAM_MEMBERS = 15;
const DEPARTMENT_OPTIONS = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "ECE", label: "Electronics & Communication Engineering" },
  { value: "EE", label: "Electrical Engineering" },
  { value: "ME", label: "Mechanical Engineering" },
  { value: "CE", label: "Civil Engineering" },
  { value: "Other", label: "Other" },
] as const;
const YEAR_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "PG / Other",
] as const;

function createEmptyTeammate(): TeamMemberDetail {
  return { name: "", rollNumber: "", department: "", academicYear: "" };
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const contentVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -50, transition: { duration: 0.2 } },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidIndianPhone(rawPhone: string): boolean {
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return /^[6-9]\d{9}$/.test(digits);
}

function normalizePhoneDisplay(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits;
}

function generateSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getInitialQuerySelection(): {
  events: string[];
  participationType: "individual" | "team";
} {
  if (typeof window === "undefined") {
    return { events: [], participationType: "individual" };
  }
  try {
    const param = new URLSearchParams(window.location.search).get("event");
    if (
      param &&
      (ALL_ALLOWED_EVENTS as readonly string[]).includes(param)
    ) {
      return {
        events: [param],
        participationType: TEAM_REQUIRED_EVENTS.has(param)
          ? "team"
          : "individual",
      };
    }
  } catch {
    /* ignore */
  }
  return { events: [], participationType: "individual" };
}

const initialFormData: RegistrationFormData = {
  fullName: "",
  email: "",
  phoneCountryCode: "+91",
  phone: "",
  college: FIXED_COLLEGE,
  rollNumber: "",
  department: "",
  academicYear: "",
  ...getInitialQuerySelection(),
  teamName: "",
  teamMemberDetails: [createEmptyTeammate()],
  notes: "",
  confirmedDetails: false,
  teamConfirmed: false,
  website: "",
};

const OnboardingForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string>(() =>
    generateSubmissionId(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    registrationId: string;
    createdAt: string;
  } | null>(null);
  const [formData, setFormData] =
    useState<RegistrationFormData>(initialFormData);

  const hasTeamApplicableSelection = formData.events.some((ev) =>
    TEAM_APPLICABLE_EVENTS.has(ev),
  );
  const hasTeamRequiredSelection = formData.events.some((ev) =>
    TEAM_REQUIRED_EVENTS.has(ev),
  );
  const isTeamEntry =
    hasTeamApplicableSelection && formData.participationType === "team";

  const updateTeammate = (
    index: number,
    field: keyof TeamMemberDetail,
    value: string,
  ) => {
    setSubmitError(null);
    setStepError(null);
    setFieldErrors({});
    setFormData((prev) => ({
      ...prev,
      teamMemberDetails: prev.teamMemberDetails.map((member, i) =>
        i === index ? { ...member, [field]: value } : member,
      ),
    }));
  };

  const addTeammate = () => {
    setSubmitError(null);
    setStepError(null);
    setFieldErrors({});
    setFormData((prev) => {
      if (prev.teamMemberDetails.length >= MAX_TEAM_MEMBERS) return prev;
      return {
        ...prev,
        teamMemberDetails: [...prev.teamMemberDetails, createEmptyTeammate()],
      };
    });
  };

  const removeTeammate = (index: number) => {
    setSubmitError(null);
    setStepError(null);
    setFieldErrors({});
    setFormData((prev) => {
      if (prev.teamMemberDetails.length <= 1) return prev;
      return {
        ...prev,
        teamMemberDetails: prev.teamMemberDetails.filter((_, i) => i !== index),
      };
    });
  };

  const updateFormData = <K extends keyof RegistrationFormData>(
    field: K,
    value: RegistrationFormData[K],
  ) => {
    setSubmitError(null);
    setStepError(null);
    setFieldErrors({});
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEvent = (eventName: string) => {
    setSubmitError(null);
    setStepError(null);
    setFieldErrors({});
    setFormData((prev) => {
      const exists = prev.events.includes(eventName);
      const nextEvents = exists
        ? prev.events.filter((e) => e !== eventName)
        : [...prev.events, eventName];
      const nextHasTeam = nextEvents.some((ev) =>
        TEAM_APPLICABLE_EVENTS.has(ev),
      );
      const nextRequiresTeam = nextEvents.some((ev) =>
        TEAM_REQUIRED_EVENTS.has(ev),
      );
      return {
        ...prev,
        events: nextEvents,
        participationType: nextRequiresTeam
          ? "team"
          : nextHasTeam
            ? prev.participationType
            : "individual",
      };
    });
  };

  const getStepFieldErrors = (stepIndex: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    switch (stepIndex) {
      case 0: {
        if (formData.fullName.trim().length < 2) {
          errors.fullName = "Please enter your full name (at least 2 characters).";
        }
        if (!EMAIL_REGEX.test(formData.email.trim())) {
          errors.email = "Please enter a valid email address.";
        }
        if (!isValidIndianPhone(formData.phone)) {
          errors.phone = "Please enter a valid 10-digit Indian mobile number (+91).";
        }
        return errors;
      }
      case 1: {
        const roll = formData.rollNumber.trim();
        if (!ROLL_NUMBER_REGEX.test(roll)) {
          errors.rollNumber =
            "Roll / Registration number is required (3–40 digits only).";
        }
        if (!formData.department) {
          errors.department = "Please select your department / branch.";
        }
        if (!formData.academicYear) {
          errors.academicYear = "Please select your academic year.";
        }
        return errors;
      }
      case 2:
        if (formData.events.length < 1) {
          errors.events =
            "Please select at least one UDAAN 2026 or IGNITION 2026 event.";
        }
        return errors;
      case 3: {
        if (!isTeamEntry) return errors;
        if (formData.teamName.trim().length < 2) {
          errors.teamName =
            "Please enter a team name (at least 2 characters) for team entries.";
        }
        if (
          formData.teamMemberDetails.length < 1 ||
          formData.teamMemberDetails.length > MAX_TEAM_MEMBERS
        ) {
          errors["member-name-0"] =
            `Team entries require between 1 and ${MAX_TEAM_MEMBERS} teammates.`;
          return errors;
        }
        const participantRoll = formData.rollNumber.trim();
        const seenRolls = new Set<string>();
        for (let i = 0; i < formData.teamMemberDetails.length; i++) {
          const m = formData.teamMemberDetails[i];
          if (m.name.trim().length < 2) {
            errors[`member-name-${i}`] =
              `Teammate ${i + 1}: please enter their full name (at least 2 characters).`;
          }
          const mRoll = m.rollNumber.trim();
          if (!ROLL_NUMBER_REGEX.test(mRoll)) {
            errors[`member-roll-${i}`] =
              `Teammate ${i + 1}: registration number must be 3–40 digits only.`;
          } else if (participantRoll && mRoll === participantRoll) {
            errors[`member-roll-${i}`] =
              `Teammate ${i + 1}: registration number cannot match your own roll number.`;
          } else if (seenRolls.has(mRoll)) {
            errors[`member-roll-${i}`] =
              `Teammate ${i + 1}: duplicate registration number (${mRoll}).`;
          } else {
            seenRolls.add(mRoll);
          }
          if (!m.department) {
            errors[`member-dept-${i}`] = `Teammate ${i + 1}: please select a branch.`;
          }
          if (!m.academicYear) {
            errors[`member-year-${i}`] =
              `Teammate ${i + 1}: please select an academic year.`;
          }
        }
        return errors;
      }
      case 4:
        if (formData.notes.length > 500) {
          errors.notes = "Notes must be 500 characters or fewer.";
        }
        return errors;
      case 5:
        if (formData.confirmedDetails !== true) {
          errors.confirmedDetails =
            "Please confirm that all details are correct and agree to the event rules.";
        }
        if (isTeamEntry && formData.teamConfirmed !== true) {
          errors.teamConfirmed =
            "Please confirm that all team members have agreed to participate and their details are correct.";
        }
        return errors;
      default:
        return errors;
    }
  };

  const focusFirstErrorField = (errors: Record<string, string>) => {
    const firstId = Object.keys(errors)[0];
    if (!firstId || typeof window === "undefined") return;
    requestAnimationFrame(() => {
      const el = document.getElementById(firstId);
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    });
  };

  const nextStep = () => {
    const errors = getStepFieldErrors(currentStep);
    const firstMsg = Object.values(errors)[0] ?? null;
    if (firstMsg) {
      setFieldErrors(errors);
      setStepError(firstMsg);
      focusFirstErrorField(errors);
      return;
    }
    setFieldErrors({});
    setStepError(null);
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setFieldErrors({});
    setStepError(null);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    const errors = getStepFieldErrors(currentStep);
    const firstMsg = Object.values(errors)[0] ?? null;
    if (firstMsg) {
      setFieldErrors(errors);
      setStepError(firstMsg);
      focusFirstErrorField(errors);
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setStepError(null);

    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submissionId,
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phoneCountryCode: "+91",
          phone: formData.phone.trim(),
          college: FIXED_COLLEGE,
          rollNumber: formData.rollNumber.trim(),
          department: formData.department,
          academicYear: formData.academicYear,
          events: formData.events,
          participationType: isTeamEntry ? "team" : "individual",
          teamName: isTeamEntry ? formData.teamName.trim() : null,
          teamMemberDetails: isTeamEntry
            ? formData.teamMemberDetails.map((m) => ({
                name: m.name.trim(),
                rollNumber: m.rollNumber.trim(),
                department: m.department,
                academicYear: m.academicYear,
              }))
            : null,
          notes: formData.notes.trim() || null,
          confirmedDetails: formData.confirmedDetails,
          teamConfirmed: isTeamEntry ? formData.teamConfirmed : false,
          website: formData.website,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        registrationId?: string;
        createdAt?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.registrationId) {
        const message =
          payload?.error ||
          "Unable to complete registration right now. Please check your details and try again.";
        setSubmitError(message);
        toast.error(message);
        return;
      }

      setSubmittedReceipt({
        registrationId: payload.registrationId,
        createdAt: payload.createdAt || new Date().toISOString(),
      });
      toast.success("UDAAN 2026 registration confirmed!");
    } catch {
      const message =
        "Network error while submitting registration. Your entered details have been preserved—please try again.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setSubmittedReceipt(null);
    setSubmitError(null);
    setFieldErrors({});
    setSubmissionId(generateSubmissionId());
    setCurrentStep(0);
  };

  // Check if step is valid
  const isStepValid = () =>
    Object.keys(getStepFieldErrors(currentStep)).length === 0;

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStep === steps.length - 1) {
      void handleSubmit();
    } else {
      nextStep();
    }
  };

  if (submittedReceipt) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="border shadow-md rounded-3xl overflow-hidden">
            <CardHeader className="text-center space-y-2 pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <CardTitle>Registration Confirmed</CardTitle>
              <CardDescription>
                Your UDAAN 2026 registration has been recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border bg-muted/40 p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Registration ID</span>
                  <span className="font-mono font-semibold text-foreground">
                    {submittedReceipt.registrationId}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Participant</span>
                  <span className="font-medium text-foreground">
                    {formData.fullName}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">Events</span>
                  <span className="font-medium text-foreground text-right">
                    {formData.events.join(", ")}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center pt-2 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="rounded-2xl"
              >
                Submit Another Registration
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4">
      {/* Progress indicator */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              className="flex flex-col items-center"
              whileHover={{ scale: 1.1 }}
            >
              <motion.button
                type="button"
                aria-label={`Step ${index + 1}: ${step.title}`}
                className={cn(
                  "w-4 h-4 rounded-full cursor-pointer transition-colors duration-300",
                  index < currentStep
                    ? "bg-primary"
                    : index === currentStep
                      ? "bg-primary ring-4 ring-primary/20"
                      : "bg-muted",
                )}
                onClick={() => {
                  if (index <= currentStep) {
                    setCurrentStep(index);
                  }
                }}
                whileTap={{ scale: 0.95 }}
              />
              <motion.span
                className={cn(
                  "text-xs mt-1.5 hidden sm:block",
                  index === currentStep
                    ? "text-primary font-medium"
                    : "text-muted-foreground",
                )}
              >
                {step.title}
              </motion.span>
            </motion.div>
          ))}
        </div>
        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="border shadow-md rounded-3xl overflow-hidden">
          <form onSubmit={handleFormSubmit} noValidate>
            {/* Honeypot field — hidden from humans */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
              }}
            >
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={formData.website}
                onChange={(e) => updateFormData("website", e.target.value)}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={contentVariants}
              >
                {/* Step 1: Participant Information */}
                {currentStep === 0 && (
                  <>
                    <CardHeader>
                      <CardTitle>Participant Information</CardTitle>
                      <CardDescription>
                        Enter your primary contact and institution details for
                        UDAAN 2026
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                          id="fullName"
                          placeholder="e.g. Aarav Kumar"
                          maxLength={120}
                          required
                          aria-invalid={Boolean(fieldErrors.fullName)}
                          aria-describedby={
                            fieldErrors.fullName ? "fullName-error" : undefined
                          }
                          value={formData.fullName}
                          onChange={(e) =>
                            updateFormData("fullName", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        {fieldErrors.fullName && (
                          <p id="fullName-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.fullName}
                          </p>
                        )}
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          maxLength={160}
                          required
                          aria-invalid={Boolean(fieldErrors.email)}
                          aria-describedby={
                            fieldErrors.email ? "email-error" : undefined
                          }
                          value={formData.email}
                          onChange={(e) =>
                            updateFormData("email", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        {fieldErrors.email && (
                          <p id="email-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.email}
                          </p>
                        )}
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="phone">Mobile Number *</Label>
                        <div className="flex gap-2 items-center">
                          <div
                            aria-label="Country code +91"
                            style={{ width: "4.5rem", flex: "0 0 4.5rem" }}
                            className="shrink-0 h-10 rounded-md border bg-muted/60 px-3 flex items-center justify-center text-sm font-medium text-foreground select-none"
                          >
                            +91
                          </div>
                          <Input
                            id="phone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="10-digit Indian mobile number"
                            maxLength={20}
                            required
                            aria-invalid={Boolean(fieldErrors.phone)}
                            aria-describedby={
                              fieldErrors.phone ? "phone-error" : undefined
                            }
                            value={formData.phone}
                            onChange={(e) =>
                              updateFormData("phone", e.target.value)
                            }
                            style={{ flex: "1 1 0%", minWidth: 0 }}
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        {fieldErrors.phone ? (
                          <p id="phone-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.phone}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Indian mobile numbers only (+91).
                          </p>
                        )}
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="college">
                          College / Institution *
                        </Label>
                        <Input
                          id="college"
                          value={FIXED_COLLEGE}
                          readOnly
                          aria-readonly="true"
                          className="bg-muted/50 text-foreground cursor-default"
                        />
                      </motion.div>
                    </CardContent>
                  </>
                )}

                {/* Step 2: Academic Information */}
                {currentStep === 1 && (
                  <>
                    <CardHeader>
                      <CardTitle>Academic Information</CardTitle>
                      <CardDescription>
                        Required academic details for organizer coordination
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="rollNumber">
                          Roll / Registration Number *
                        </Label>
                        <Input
                          id="rollNumber"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="e.g. 23101105001"
                          maxLength={40}
                          required
                          aria-invalid={Boolean(fieldErrors.rollNumber)}
                          aria-describedby={
                            fieldErrors.rollNumber
                              ? "rollNumber-error"
                              : undefined
                          }
                          value={formData.rollNumber}
                          onChange={(e) =>
                            updateFormData(
                              "rollNumber",
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        {fieldErrors.rollNumber && (
                          <p id="rollNumber-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.rollNumber}
                          </p>
                        )}
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="department">
                          Department / Branch *
                        </Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) =>
                            updateFormData("department", value)
                          }
                        >
                          <SelectTrigger
                            id="department"
                            aria-required="true"
                            aria-invalid={Boolean(fieldErrors.department)}
                            aria-describedby={
                              fieldErrors.department
                                ? "department-error"
                                : undefined
                            }
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldErrors.department && (
                          <p id="department-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.department}
                          </p>
                        )}
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="academicYear">
                          Academic Year *
                        </Label>
                        <Select
                          value={formData.academicYear}
                          onValueChange={(value) =>
                            updateFormData("academicYear", value)
                          }
                        >
                          <SelectTrigger
                            id="academicYear"
                            aria-required="true"
                            aria-invalid={Boolean(fieldErrors.academicYear)}
                            aria-describedby={
                              fieldErrors.academicYear
                                ? "academicYear-error"
                                : undefined
                            }
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            <SelectValue placeholder="Select academic year" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((yr) => (
                              <SelectItem key={yr} value={yr}>
                                {yr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldErrors.academicYear && (
                          <p id="academicYear-error" role="alert" className="text-xs text-destructive">
                            {fieldErrors.academicYear}
                          </p>
                        )}
                      </motion.div>
                    </CardContent>
                  </>
                )}

                {/* Step 3: Event Selection */}
                {currentStep === 2 && (
                  <>
                    <CardHeader>
                      <CardTitle>Event Selection</CardTitle>
                      <CardDescription>
                        Select one or more UDAAN 2026 sports/cultural events or
                        IGNITION 2026 esports titles included in this
                        registration flow
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label>UDAAN 2026 — Sports &amp; Cultural Events</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {UDAAN_SPORTS_AND_CULTURAL_EVENTS.map(
                            (eventName, index) => (
                              <motion.div
                                key={eventName}
                                className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  transition: {
                                    delay: 0.03 * index,
                                    duration: 0.25,
                                  },
                                }}
                                onClick={() => toggleEvent(eventName)}
                              >
                                <Checkbox
                                  id={`event-${eventName}`}
                                  checked={formData.events.includes(eventName)}
                                  onCheckedChange={() => toggleEvent(eventName)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Label
                                  htmlFor={`event-${eventName}`}
                                  className="cursor-pointer w-full"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {eventName}
                                </Label>
                              </motion.div>
                            ),
                          )}
                        </div>
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label>IGNITION 2026 — Esports (Separate Track)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {IGNITION_ESPORTS_EVENTS.map((eventName, index) => (
                            <motion.div
                              key={eventName}
                              className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ duration: 0.2 }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                transition: {
                                  delay: 0.04 * index,
                                  duration: 0.25,
                                },
                              }}
                              onClick={() => toggleEvent(eventName)}
                            >
                              <Checkbox
                                id={`event-${eventName}`}
                                checked={formData.events.includes(eventName)}
                                onCheckedChange={() => toggleEvent(eventName)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Label
                                htmlFor={`event-${eventName}`}
                                className="cursor-pointer w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {eventName}
                              </Label>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    </CardContent>
                  </>
                )}

                {/* Step 4: Participation & Team */}
                {currentStep === 3 && (
                  <>
                    <CardHeader>
                      <CardTitle>Participation &amp; Team</CardTitle>
                      <CardDescription>
                        {hasTeamRequiredSelection
                          ? "Team entry is required for IGNITION esports events"
                          : hasTeamApplicableSelection
                            ? "Specify whether you are registering individually or as part of a team"
                            : "Your selected events are individual entries"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {hasTeamApplicableSelection ? (
                        <>
                          <motion.div variants={fadeInUp} className="space-y-2">
                            <Label>Participation Mode</Label>
                            <RadioGroup
                              value={formData.participationType}
                              onValueChange={(value) => {
                                if (hasTeamRequiredSelection && value !== "team") {
                                  return;
                                }
                                updateFormData(
                                  "participationType",
                                  value === "team" ? "team" : "individual",
                                );
                              }}
                              className="space-y-2"
                            >
                              {[
                                {
                                  value: "individual",
                                  label: "Individual Participant",
                                  disabled: hasTeamRequiredSelection,
                                },
                                {
                                  value: "team",
                                  label: "Team Entry",
                                  disabled: false,
                                },
                              ].map((opt, index) => (
                                <motion.div
                                  key={opt.value}
                                  className={`flex items-center space-x-2 rounded-md border p-3 transition-colors ${
                                    opt.disabled
                                      ? "opacity-50 cursor-not-allowed"
                                      : "cursor-pointer hover:bg-accent"
                                  }`}
                                  whileHover={opt.disabled ? undefined : { scale: 1.02 }}
                                  whileTap={opt.disabled ? undefined : { scale: 0.98 }}
                                  transition={{ duration: 0.2 }}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{
                                    opacity: 1,
                                    x: 0,
                                    transition: {
                                      delay: 0.08 * index,
                                      duration: 0.25,
                                    },
                                  }}
                                >
                                  <RadioGroupItem
                                    value={opt.value}
                                    id={`participation-${opt.value}`}
                                    disabled={opt.disabled}
                                  />
                                  <Label
                                    htmlFor={`participation-${opt.value}`}
                                    className={
                                      opt.disabled
                                        ? "cursor-not-allowed w-full"
                                        : "cursor-pointer w-full"
                                    }
                                  >
                                    {opt.label}
                                  </Label>
                                </motion.div>
                              ))}
                            </RadioGroup>
                          </motion.div>

                          {formData.participationType === "team" && (
                            <>
                              <motion.div
                                variants={fadeInUp}
                                className="space-y-2"
                              >
                                <Label htmlFor="teamName">Team Name *</Label>
                                <Input
                                  id="teamName"
                                  placeholder="Enter your team name"
                                  maxLength={100}
                                  required
                                  aria-invalid={Boolean(fieldErrors.teamName)}
                                  aria-describedby={
                                    fieldErrors.teamName
                                      ? "teamName-error"
                                      : undefined
                                  }
                                  value={formData.teamName}
                                  onChange={(e) =>
                                    updateFormData("teamName", e.target.value)
                                  }
                                  className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                                {fieldErrors.teamName && (
                                  <p id="teamName-error" role="alert" className="text-xs text-destructive">
                                    {fieldErrors.teamName}
                                  </p>
                                )}
                              </motion.div>
                              <motion.div
                                variants={fadeInUp}
                                className="space-y-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <Label>Team Members *</Label>
                                  <span className="text-xs text-muted-foreground">
                                    {formData.teamMemberDetails.length}/{MAX_TEAM_MEMBERS}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {formData.teamMemberDetails.map((member, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-xl border bg-muted/20 p-3 space-y-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Teammate {idx + 1}
                                        </span>
                                        {formData.teamMemberDetails.length > 1 && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeTeammate(idx)}
                                            aria-label={`Remove teammate ${idx + 1}`}
                                            className="min-h-[44px] min-w-[44px] px-2 text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`member-name-${idx}`}>
                                            Full Name *
                                          </Label>
                                          <Input
                                            id={`member-name-${idx}`}
                                            placeholder="Teammate full name"
                                            maxLength={120}
                                            required
                                            aria-invalid={Boolean(fieldErrors[`member-name-${idx}`])}
                                            aria-describedby={
                                              fieldErrors[`member-name-${idx}`]
                                                ? `member-name-${idx}-error`
                                                : undefined
                                            }
                                            value={member.name}
                                            onChange={(e) =>
                                              updateTeammate(idx, "name", e.target.value)
                                            }
                                          />
                                          {fieldErrors[`member-name-${idx}`] && (
                                            <p
                                              id={`member-name-${idx}-error`}
                                              role="alert"
                                              className="text-xs text-destructive"
                                            >
                                              {fieldErrors[`member-name-${idx}`]}
                                            </p>
                                          )}
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`member-roll-${idx}`}>
                                            Registration Number *
                                          </Label>
                                          <Input
                                            id={`member-roll-${idx}`}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="e.g. 23101105002"
                                            maxLength={40}
                                            required
                                            aria-invalid={Boolean(fieldErrors[`member-roll-${idx}`])}
                                            aria-describedby={
                                              fieldErrors[`member-roll-${idx}`]
                                                ? `member-roll-${idx}-error`
                                                : undefined
                                            }
                                            value={member.rollNumber}
                                            onChange={(e) =>
                                              updateTeammate(
                                                idx,
                                                "rollNumber",
                                                e.target.value.replace(/\D/g, ""),
                                              )
                                            }
                                          />
                                          {fieldErrors[`member-roll-${idx}`] && (
                                            <p
                                              id={`member-roll-${idx}-error`}
                                              role="alert"
                                              className="text-xs text-destructive"
                                            >
                                              {fieldErrors[`member-roll-${idx}`]}
                                            </p>
                                          )}
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`member-dept-${idx}`}>
                                            Branch *
                                          </Label>
                                          <Select
                                            value={member.department}
                                            onValueChange={(value) =>
                                              updateTeammate(idx, "department", value)
                                            }
                                          >
                                            <SelectTrigger
                                              id={`member-dept-${idx}`}
                                              aria-required="true"
                                              aria-invalid={Boolean(fieldErrors[`member-dept-${idx}`])}
                                              aria-describedby={
                                                fieldErrors[`member-dept-${idx}`]
                                                  ? `member-dept-${idx}-error`
                                                  : undefined
                                              }
                                            >
                                              <SelectValue placeholder="Select branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {DEPARTMENT_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                  {opt.value}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          {fieldErrors[`member-dept-${idx}`] && (
                                            <p
                                              id={`member-dept-${idx}-error`}
                                              role="alert"
                                              className="text-xs text-destructive"
                                            >
                                              {fieldErrors[`member-dept-${idx}`]}
                                            </p>
                                          )}
                                        </div>
                                        <div className="space-y-1.5">
                                          <Label htmlFor={`member-year-${idx}`}>
                                            Year *
                                          </Label>
                                          <Select
                                            value={member.academicYear}
                                            onValueChange={(value) =>
                                              updateTeammate(idx, "academicYear", value)
                                            }
                                          >
                                            <SelectTrigger
                                              id={`member-year-${idx}`}
                                              aria-required="true"
                                              aria-invalid={Boolean(fieldErrors[`member-year-${idx}`])}
                                              aria-describedby={
                                                fieldErrors[`member-year-${idx}`]
                                                  ? `member-year-${idx}-error`
                                                  : undefined
                                              }
                                            >
                                              <SelectValue placeholder="Select year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {YEAR_OPTIONS.map((yr) => (
                                                <SelectItem key={yr} value={yr}>
                                                  {yr}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          {fieldErrors[`member-year-${idx}`] && (
                                            <p
                                              id={`member-year-${idx}-error`}
                                              role="alert"
                                              className="text-xs text-destructive"
                                            >
                                              {fieldErrors[`member-year-${idx}`]}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={addTeammate}
                                  disabled={formData.teamMemberDetails.length >= MAX_TEAM_MEMBERS}
                                  className="w-full sm:w-auto min-h-[44px] rounded-xl"
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add teammate
                                </Button>
                              </motion.div>
                            </>
                          )}
                        </>
                      ) : (
                        <motion.div
                          variants={fadeInUp}
                          className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"
                        >
                          Selected events ({formData.events.join(", ")}) do not
                          require team details. You can proceed to the next step.
                        </motion.div>
                      )}
                    </CardContent>
                  </>
                )}

                {/* Step 5: Additional Information */}
                {currentStep === 4 && (
                  <>
                    <CardHeader>
                      <CardTitle>Additional Information</CardTitle>
                      <CardDescription>
                        Optional notes for the UDAAN 2026 organizing team
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Any scheduling preferences or event-related notes"
                          maxLength={500}
                          value={formData.notes}
                          onChange={(e) =>
                            updateFormData("notes", e.target.value)
                          }
                          className="min-h-[100px] transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {formData.notes.length}/500
                        </p>
                      </motion.div>
                    </CardContent>
                  </>
                )}

                {/* Step 6: Review & Consent */}
                {currentStep === 5 && (
                  <>
                    <CardHeader>
                      <CardTitle>Review &amp; Consent</CardTitle>
                      <CardDescription>
                        Verify your details before submitting. You can jump back
                        to any step without losing your entries.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <motion.div
                        variants={fadeInUp}
                        className="rounded-2xl border bg-muted/30 p-4 space-y-2.5 text-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium text-right">
                            {formData.fullName}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Email</span>
                          <span className="font-medium text-right">
                            {formData.email}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Mobile</span>
                          <span className="font-medium text-right">
                            +91 {normalizePhoneDisplay(formData.phone)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">College</span>
                          <span className="font-medium text-right">
                            {FIXED_COLLEGE}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Roll No.
                          </span>
                          <span className="font-medium text-right">
                            {formData.rollNumber.trim()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Branch &amp; Year
                          </span>
                          <span className="font-medium text-right">
                            {formData.department} · {formData.academicYear}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Events</span>
                          <span className="font-medium text-right">
                            {formData.events.join(", ")}
                          </span>
                        </div>
                        {hasTeamApplicableSelection && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Participation
                            </span>
                            <span className="font-medium text-right capitalize">
                              {formData.participationType}
                              {isTeamEntry && formData.teamName
                                ? ` (${formData.teamName})`
                                : ""}
                            </span>
                          </div>
                        )}
                        {isTeamEntry && (
                          <div className="pt-1 border-t space-y-1.5">
                            <span className="text-muted-foreground block">
                              Team Members ({formData.teamMemberDetails.length})
                            </span>
                            <ul className="space-y-1 text-xs">
                              {formData.teamMemberDetails.map((m, idx) => (
                                <li
                                  key={idx}
                                  className="flex flex-wrap justify-between gap-2 rounded-md bg-background/60 px-2.5 py-1.5"
                                >
                                  <span className="font-medium">{m.name.trim()}</span>
                                  <span className="text-muted-foreground">
                                    {m.rollNumber.trim()} · {m.department} · {m.academicYear}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {formData.notes.trim() && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Notes</span>
                            <span className="font-medium text-right">
                              {formData.notes}
                            </span>
                          </div>
                        )}
                      </motion.div>

                      <motion.div
                        variants={fadeInUp}
                        className="rounded-xl border border-border/80 bg-background/60 p-3 text-xs text-muted-foreground leading-relaxed"
                      >
                        Data-use notice: The information submitted in this form
                        is collected solely to process and coordinate your UDAAN
                        2026 event registration at Bhagalpur College of
                        Engineering, Sabour.
                      </motion.div>

                      <motion.div
                        variants={fadeInUp}
                        className="flex items-start space-x-3 rounded-xl border p-3.5 min-h-[44px] cursor-pointer hover:bg-accent/50 transition-colors focus-within:ring-2 focus-within:ring-primary"
                        onClick={() =>
                          updateFormData(
                            "confirmedDetails",
                            !formData.confirmedDetails,
                          )
                        }
                      >
                        <Checkbox
                          id="confirmedDetails"
                          checked={formData.confirmedDetails}
                          aria-required="true"
                          onCheckedChange={(checked) =>
                            updateFormData("confirmedDetails", checked === true)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-5 w-5"
                        />
                        <Label
                          htmlFor="confirmedDetails"
                          className="cursor-pointer leading-snug text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          I confirm all the details above are correct and I
                          agree to the event rules. *
                        </Label>
                      </motion.div>

                      {isTeamEntry && (
                        <motion.div
                          variants={fadeInUp}
                          className="flex items-start space-x-3 rounded-xl border p-3.5 min-h-[44px] cursor-pointer hover:bg-accent/50 transition-colors focus-within:ring-2 focus-within:ring-primary"
                          onClick={() =>
                            updateFormData(
                              "teamConfirmed",
                              !formData.teamConfirmed,
                            )
                          }
                        >
                          <Checkbox
                            id="teamConfirmed"
                            checked={formData.teamConfirmed}
                            aria-required="true"
                            onCheckedChange={(checked) =>
                              updateFormData("teamConfirmed", checked === true)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 h-5 w-5"
                          />
                          <Label
                            htmlFor="teamConfirmed"
                            className="cursor-pointer leading-snug text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            I confirm all team members have agreed to
                            participate and their details are correct. *
                          </Label>
                        </motion.div>
                      )}

                      {submitError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{submitError}</span>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {stepError && (
              <div className="px-6 pt-2">
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{stepError}</span>
                </div>
              </div>
            )}

            <CardFooter className="flex justify-between pt-6 pb-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0 || isSubmitting}
                  className="flex items-center gap-1 min-h-[44px] transition-all duration-300 rounded-2xl"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (currentStep === steps.length - 1 &&
                      (!formData.confirmedDetails ||
                        (isTeamEntry && !formData.teamConfirmed)))
                  }
                  className={cn(
                    "flex items-center gap-1 min-h-[44px] transition-all duration-300 rounded-2xl",
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      {currentStep === steps.length - 1 ? "Submit" : "Next"}
                      {currentStep === steps.length - 1 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </>
                  )}
                </Button>
              </motion.div>
            </CardFooter>
          </form>
        </Card>
      </motion.div>

      {/* Step indicator */}
      <motion.div
        className="mt-4 text-center text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
      </motion.div>
    </div>
  );
};

export default OnboardingForm;
