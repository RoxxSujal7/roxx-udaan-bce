import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import OnboardingForm from "@/components/ui/multistep-form";

const rootElement = document.getElementById("registration-form-root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <OnboardingForm />
      <Toaster richColors position="top-center" />
    </StrictMode>,
  );
}
