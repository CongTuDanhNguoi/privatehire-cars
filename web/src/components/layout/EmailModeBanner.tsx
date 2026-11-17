// Makes it obvious whether replies really go out by email (plan §8.4):
// MOCK → nothing is sent · EMAILJS + test mode → everything goes to one test inbox · EMAILJS live → no banner.
import { useEffect, useState } from "react";
import { emailSettingsApi } from "../../api/staff";
import type { EmailSettings } from "../../types";
import { Alert } from "../ui/Alert";

export function useEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    emailSettingsApi
      .get()
      .then((s) => !cancelled && setSettings(s))
      .catch(() => {
        /* the banner is informational; ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}

export function EmailModeBanner({ settings }: { settings: EmailSettings | null }) {
  if (!settings) return null;
  if (settings.provider === "MOCK") {
    return (
      <Alert variant="info" title="Mock email service">
        Responses are saved but NO real email is sent.
      </Alert>
    );
  }
  if (settings.testMode) {
    return (
      <Alert variant="info" title="Test mode">
        All emails are delivered to <strong>{settings.testRecipient}</strong> instead of the customer.
      </Alert>
    );
  }
  return null;
}
