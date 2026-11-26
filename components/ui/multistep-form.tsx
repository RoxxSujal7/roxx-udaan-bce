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

export const UDAAN_SPORTS_AND_CULTURAL_EVENTS = [
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
] as const;

export const IGNITION_ESPORTS_EVENTS = [
  "COD Mobile",
  "Valorant",
  "Clash Royale",
] as const;

export const ALL_ALLOWED_EVENTS = [
  ...UDAAN_SPORTS_AND_CULTURAL_EVENTS,
  ...IGNITION_ESPORTS_EVENTS,
] as const;

const TEAM_APPLICABLE_EVENTS = new Set<string>([
  "Cricket",
  "Football",
  "Volleyball",
  "Kabaddi",
  "Tug of War",
  "Badminton",
  "Table Tennis",
  "COD Mobile",
  "Valorant",
]);

const steps = [
  { id: "participant", title: "Participant" },
  { id: "academic", title: "Academic" },
  { id: "events", title: "Events" },
  { id: "team", title: "Team" },
  { id: "additional", title: "Notes" },
  { id: "review", title: "Review" },
];

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
  teamMembers: string;
  notes: string;
  confirmedDetails: boolean;
  website: string; // Honeypot field (must remain empty)
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

function isValidPhoneInput(countryCode: string, rawPhone: string): boolean {
  const code = countryCode.trim() || "+91";
  if (!/^\+[1-9]\d{0,3}$/.test(code)) {
    return false;
  }
  let digits = rawPhone.replace(/\D/g, "");
  if (code === "+91") {
    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    } else if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    }
    return /^[6-9]\d{9}$/.test(digits);
  }
  const e164 = `${code}${digits}`;
  return digits.length >= 6 && digits.length <= 14 && /^\+[1-9]\d{7,14}$/.test(e164);
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

const initialFormData: RegistrationFormData = {
  fullName: "",
  email: "",
  phoneCountryCode: "+91",
  phone: "",
  college: "",
  rollNumber: "",
  department: "",
  academicYear: "",
  events: [],
  participationType: "individual",
  teamName: "",
  teamMembers: "",
  notes: "",
  confirmedDetails: false,
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
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    registrationId: string;
    createdAt: string;
  } | null>(null);
  const [formData, setFormData] =
    useState<RegistrationFormData>(initialFormData);

  const hasTeamApplicableSelection = formData.events.some((ev) =>
    TEAM_APPLICABLE_EVENTS.has(ev),
  );

  const updateFormData = <K extends keyof RegistrationFormData>(
    field: K,
    value: RegistrationFormData[K],
  ) => {
    setSubmitError(null);
    setStepError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEvent = (eventName: string) => {
    setSubmitError(null);
    setStepError(null);
    setFormData((prev) => {
      const exists = prev.events.includes(eventName);
      const nextEvents = exists
        ? prev.events.filter((e) => e !== eventName)
        : [...prev.events, eventName];
      const nextHasTeam = nextEvents.some((ev) =>
        TEAM_APPLICABLE_EVENTS.has(ev),
      );
      return {
        ...prev,
        events: nextEvents,
        participationType: nextHasTeam ? prev.participationType : "individual",
      };
    });
  };

  const getStepValidationError = (stepIndex: number): string | null => {
    switch (stepIndex) {
      case 0: {
        if (formData.fullName.trim().length < 2) {
          return "Please enter your full name (at least 2 characters).";
        }
        if (!EMAIL_REGEX.test(formData.email.trim())) {
          return "Please enter a valid email address.";
        }
        const code = formData.phoneCountryCode.trim() || "+91";
        if (!/^\+[1-9]\d{0,3}$/.test(code)) {
          return "Please enter a valid country code (e.g. +91).";
        }
        if (!isValidPhoneInput(code, formData.phone)) {
          return code === "+91"
            ? "Please enter a valid 10-digit Indian mobile number."
            : "Please enter a valid international mobile number (6–14 digits).";
        }
        if (formData.college.trim().length < 2) {
          return "Please enter your college or institution name.";
        }
        return null;
      }
      case 1:
        return null;
      case 2:
        return formData.events.length >= 1
          ? null
          : "Please select at least one UDAAN 2026 or IGNITION 2026 event.";
      case 3:
        if (
          hasTeamApplicableSelection &&
          formData.participationType === "team" &&
          formData.teamName.trim().length < 2
        ) {
          return "Please enter a team name (at least 2 characters) for team entries.";
        }
        return null;
      case 4:
        return formData.notes.length <= 500
          ? null
          : "Notes must be 500 characters or fewer.";
      case 5:
        return formData.confirmedDetails === true
          ? null
          : "Please confirm accuracy and consent before submitting.";
      default:
        return null;
    }
  };

  const nextStep = () => {
    const err = getStepValidationError(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setStepError(null);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    const err = getStepValidationError(currentStep);
    if (err) {
      setStepError(err);
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
          phoneCountryCode: formData.phoneCountryCode.trim(),
          phone: formData.phone.trim(),
          college: formData.college.trim(),
          rollNumber: formData.rollNumber.trim() || null,
          department: formData.department || null,
          academicYear: formData.academicYear || null,
          events: formData.events,
          participationType: hasTeamApplicableSelection
            ? formData.participationType
            : "individual",
          teamName:
            hasTeamApplicableSelection &&
            formData.participationType === "team"
              ? formData.teamName.trim() || null
              : null,
          teamMembers:
            hasTeamApplicableSelection &&
            formData.participationType === "team"
              ? formData.teamMembers.trim() || null
              : null,
          notes: formData.notes.trim() || null,
          confirmedDetails: formData.confirmedDetails,
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
    setSubmissionId(generateSubmissionId());
    setCurrentStep(0);
  };

  // Check if step is valid
  const isStepValid = () => getStepValidationError(currentStep) === null;

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
                          value={formData.fullName}
                          onChange={(e) =>
                            updateFormData("fullName", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          maxLength={160}
                          required
                          value={formData.email}
                          onChange={(e) =>
                            updateFormData("email", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="phone">Mobile Number *</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="phoneCountryCode"
                            type="tel"
                            aria-label="Country code"
                            autoComplete="tel-country-code"
                            placeholder="+91"
                            maxLength={5}
                            value={formData.phoneCountryCode}
                            onChange={(e) =>
                              updateFormData("phoneCountryCode", e.target.value)
                            }
                            style={{ width: "5.5rem", flex: "0 0 5.5rem" }}
                            className="shrink-0 text-center transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <Input
                            id="phone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            placeholder="10-digit mobile or international number"
                            maxLength={20}
                            required
                            value={formData.phone}
                            onChange={(e) =>
                              updateFormData("phone", e.target.value)
                            }
                            style={{ flex: "1 1 0%", minWidth: 0 }}
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Default +91 for India; update country code for
                          international numbers.
                        </p>
                      </motion.div>
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="college">
                          College / Institution *
                        </Label>
                        <Input
                          id="college"
                          placeholder="e.g. Bhagalpur College of Engineering, Sabour"
                          maxLength={160}
                          required
                          value={formData.college}
                          onChange={(e) =>
                            updateFormData("college", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                        Optional academic details to help organizers coordinate
                        by batch and department
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="rollNumber">
                          Roll / Registration Number (Optional)
                        </Label>
                        <Input
                          id="rollNumber"
                          placeholder="e.g. 23101105001"
                          maxLength={40}
                          value={formData.rollNumber}
                          onChange={(e) =>
                            updateFormData("rollNumber", e.target.value)
                          }
                          className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="department">
                          Department / Branch (Optional)
                        </Label>
                        <Select
                          value={formData.department}
                          onValueChange={(value) =>
                            updateFormData("department", value)
                          }
                        >
                          <SelectTrigger
                            id="department"
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CSE">
                              Computer Science &amp; Engineering
                            </SelectItem>
                            <SelectItem value="ECE">
                              Electronics &amp; Communication Engineering
                            </SelectItem>
                            <SelectItem value="EE">
                              Electrical Engineering
                            </SelectItem>
                            <SelectItem value="ME">
                              Mechanical Engineering
                            </SelectItem>
                            <SelectItem value="CE">Civil Engineering</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>

                      <motion.div variants={fadeInUp} className="space-y-2">
                        <Label htmlFor="academicYear">
                          Academic Year (Optional)
                        </Label>
                        <Select
                          value={formData.academicYear}
                          onValueChange={(value) =>
                            updateFormData("academicYear", value)
                          }
                        >
                          <SelectTrigger
                            id="academicYear"
                            className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            <SelectValue placeholder="Select academic year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1st Year">1st Year</SelectItem>
                            <SelectItem value="2nd Year">2nd Year</SelectItem>
                            <SelectItem value="3rd Year">3rd Year</SelectItem>
                            <SelectItem value="4th Year">4th Year</SelectItem>
                            <SelectItem value="PG / Other">
                              PG / Other
                            </SelectItem>
                          </SelectContent>
                        </Select>
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
                        {hasTeamApplicableSelection
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
                              onValueChange={(value) =>
                                updateFormData(
                                  "participationType",
                                  value === "team" ? "team" : "individual",
                                )
                              }
                              className="space-y-2"
                            >
                              {[
                                {
                                  value: "individual",
                                  label: "Individual Participant",
                                },
                                {
                                  value: "team",
                                  label: "Team Entry",
                                },
                              ].map((opt, index) => (
                                <motion.div
                                  key={opt.value}
                                  className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-accent transition-colors"
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
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
                                  />
                                  <Label
                                    htmlFor={`participation-${opt.value}`}
                                    className="cursor-pointer w-full"
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
                                  value={formData.teamName}
                                  onChange={(e) =>
                                    updateFormData("teamName", e.target.value)
                                  }
                                  className="transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                              </motion.div>
                              <motion.div
                                variants={fadeInUp}
                                className="space-y-2"
                              >
                                <Label htmlFor="teamMembers">
                                  Teammate Details (Optional)
                                </Label>
                                <Textarea
                                  id="teamMembers"
                                  placeholder="List teammate names or roll numbers if known"
                                  maxLength={500}
                                  value={formData.teamMembers}
                                  onChange={(e) =>
                                    updateFormData(
                                      "teamMembers",
                                      e.target.value,
                                    )
                                  }
                                  className="min-h-[80px] transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
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
                            {formData.phoneCountryCode} {formData.phone}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">College</span>
                          <span className="font-medium text-right">
                            {formData.college}
                          </span>
                        </div>
                        {(formData.rollNumber ||
                          formData.department ||
                          formData.academicYear) && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Academic
                            </span>
                            <span className="font-medium text-right">
                              {[
                                formData.rollNumber,
                                formData.department,
                                formData.academicYear,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        )}
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
                              {formData.participationType === "team" &&
                              formData.teamName
                                ? ` (${formData.teamName})`
                                : ""}
                            </span>
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
                        className="flex items-start space-x-2 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
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
                          onCheckedChange={(checked) =>
                            updateFormData("confirmedDetails", checked === true)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor="confirmedDetails"
                          className="cursor-pointer leading-snug"
                          onClick={(e) => e.stopPropagation()}
                        >
                          I confirm that the above details are accurate and
                          consent to their use for UDAAN 2026 event
                          registration. *
                        </Label>
                      </motion.div>

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
                  className="flex items-center gap-1 transition-all duration-300 rounded-2xl"
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
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-1 transition-all duration-300 rounded-2xl",
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
