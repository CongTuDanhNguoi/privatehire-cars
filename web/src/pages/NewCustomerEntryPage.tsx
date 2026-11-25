// Provisional New Customer Entry page for SCRUM-107 AC5.
// Protected by backend caller verification (GET /api/staff/customers/new/entry).
// Does NOT submit/save a customer record, generate passwords, or alter email_verified_at.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { customersApi } from "../api/customers";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TextField } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { Spinner } from "../components/ui/Spinner";

export default function NewCustomerEntryPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  // Provisional entry fields (not persisted in SCRUM-25)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [homeAddress, setHomeAddress] = useState("");

  useEffect(() => {
    let active = true;
    customersApi
      .getNewCustomerEntry()
      .then((res) => {
        if (!active) return;
        setVerifiedPhone(res.phoneNormalized);
        setBlockedMessage("");
      })
      .catch((err) => {
        if (!active) return;
        setBlockedMessage(
          err instanceof ApiError
            ? err.message
            : "Telephone verification is required before accessing new-customer account creation.",
        );
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 py-10 text-body text-ink">
        <Spinner small label="Verifying caller session…" />
        Verifying caller session…
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-title font-bold text-ink">New Customer</h1>
        <Alert variant="error" title="Verification Required">
          {blockedMessage}
        </Alert>
        <div>
          <Button variant="secondary" onClick={() => navigate("/customers")}>
            <Icon name="arrowLeft" size={18} />
            Back to Customer Lookup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-ink">New Customer</h1>
          <p className="mt-1 text-body text-ink/70">
            Begin new-customer account creation for a verified caller telephone number.
          </p>
        </div>
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-muted bg-muted px-2.5 py-0.5 text-helper font-semibold text-ink">
          Provisional UI (SCRUM-107 AC5)
        </span>
      </header>

      <Alert variant="info" title="No customer account has been saved yet">
        This is the verified account-creation entry screen for SCRUM-25. Full customer registration and saving records
        are outside SCRUM-25 scope.
      </Alert>

      <Card title="New Customer Details (Provisional)">
        <div className="flex flex-col gap-4">
          <TextField
            label="Verified telephone number"
            name="verifiedPhone"
            value={verifiedPhone}
            readOnly
            disabled
            hint="Locked to the verified caller telephone number. Return to Customer Lookup to verify a different number."
          />
          <TextField
            label="Full Name"
            name="fullName"
            placeholder="e.g. Jordan Taylor"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Email Address"
            name="email"
            type="email"
            placeholder="e.g. jordan.taylor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Home Address (Optional — Provisional)"
            name="homeAddress"
            placeholder="Optional address"
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate("/customers")}>
              <Icon name="arrowLeft" size={18} />
              Back to Customer Lookup
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
