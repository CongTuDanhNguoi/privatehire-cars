// Provisional Customer Search, Simulated Caller OTP, Booking History & Verified New-Customer Entry (SCRUM-106 + SCRUM-107).
// Final layout and visual polish are subject to SCRUM-104 (UX Wireframes) and SCRUM-105 (High-Fidelity UI) approval.
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { validateCallerOtp } from "../../../backend/src/validation/callerOtp";
import { validateSearchPhone } from "../../../backend/src/validation/customerSearch";
import { ApiError } from "../api/client";
import { customersApi } from "../api/customers";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TextField } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { Spinner } from "../components/ui/Spinner";
import { formatDateTime, UK_TIME_ZONE } from "../lib/format";
import type {
  CustomerSearchCandidate,
  NewCustomerBeginResponse,
  SimulatedOtpResponse,
  StaffCustomerBooking,
  VerifiedCustomerProfile,
} from "../types";

export default function CustomerSearchPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [searchedPhone, setSearchedPhone] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CustomerSearchCandidate[] | null>(null);
  const [selected, setSelected] = useState<CustomerSearchCandidate | null>(null);
  const [clearing, setClearing] = useState(false);

  // Existing-customer OTP & verified state
  const [otpChallenge, setOtpChallenge] = useState<SimulatedOtpResponse | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState<VerifiedCustomerProfile | null>(null);
  const [bookings, setBookings] = useState<StaffCustomerBooking[] | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  // New-customer verification entry state (AC5)
  const [newOtpChallenge, setNewOtpChallenge] = useState<SimulatedOtpResponse | null>(null);
  const [newOtpSending, setNewOtpSending] = useState(false);
  const [newOtpCode, setNewOtpCode] = useState("");
  const [newOtpError, setNewOtpError] = useState("");
  const [newOtpVerifying, setNewOtpVerifying] = useState(false);
  const [newVerifiedPhone, setNewVerifiedPhone] = useState<string | null>(null);
  const [newEntryResult, setNewEntryResult] = useState<NewCustomerBeginResponse | null>(null);
  const [newEntryError, setNewEntryError] = useState("");

  function resetExistingVerificationState() {
    setOtpChallenge(null);
    setOtpCode("");
    setOtpError("");
    setVerifiedProfile(null);
    setBookings(null);
    setBookingsError("");
  }

  function resetNewCustomerState() {
    setNewOtpChallenge(null);
    setNewOtpCode("");
    setNewOtpError("");
    setNewVerifiedPhone(null);
    setNewEntryResult(null);
    setNewEntryError("");
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setApiError("");
    const err = validateSearchPhone(phone);
    setFieldError(err);
    if (err) return;

    setLoading(true);
    setSelected(null);
    resetExistingVerificationState();
    resetNewCustomerState();
    try {
      await customersApi.clearCallerSession().catch(() => undefined);
      const data = await customersApi.searchByPhone(phone);
      setResults(data.customers);
      setSearchedPhone(phone.trim());
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields.phone) setFieldError(error.fields.phone);
        else setApiError(error.message);
      } else {
        setApiError("Unable to search customers right now. Please try again.");
      }
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectCustomer(candidate: CustomerSearchCandidate) {
    setApiError("");
    resetExistingVerificationState();
    await customersApi.clearCallerSession().catch(() => undefined);
    setSelected(candidate);
  }

  async function handleClearSelection() {
    setClearing(true);
    try {
      await customersApi.clearCallerSession().catch(() => undefined);
      setSelected(null);
      resetExistingVerificationState();
    } finally {
      setClearing(false);
    }
  }

  async function handleSendOtp() {
    if (!selected) return;
    setOtpSending(true);
    setOtpError("");
    setOtpCode("");
    try {
      const challenge = await customersApi.sendOtp(selected.id);
      setOtpChallenge(challenge);
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : "Unable to send simulated verification code.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const err = validateCallerOtp(otpCode);
    setOtpError(err);
    if (err) return;

    setOtpVerifying(true);
    try {
      await customersApi.verifyOtp(selected.id, otpCode);
      const profileRes = await customersApi.getProfile(selected.id);
      setVerifiedProfile(profileRes.customer);
      setOtpChallenge(null);
      setOtpError("");

      setBookingsLoading(true);
      setBookingsError("");
      try {
        const bookingsRes = await customersApi.getBookings(selected.id);
        setBookings(bookingsRes.bookings);
      } catch (bErr) {
        setBookings(null);
        setBookingsError(bErr instanceof ApiError ? bErr.message : "Unable to load booking history.");
      } finally {
        setBookingsLoading(false);
      }
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : "Verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleSendNewCustomerOtp() {
    setNewOtpSending(true);
    setNewOtpError("");
    setNewOtpCode("");
    setNewVerifiedPhone(null);
    setNewEntryResult(null);
    setNewEntryError("");
    try {
      const challenge = await customersApi.sendNewCustomerOtp(searchedPhone);
      setNewOtpChallenge(challenge);
    } catch (error) {
      setNewOtpError(error instanceof ApiError ? error.message : "Unable to send simulated verification code.");
    } finally {
      setNewOtpSending(false);
    }
  }

  async function handleVerifyNewCustomerOtp(e: FormEvent) {
    e.preventDefault();
    const err = validateCallerOtp(newOtpCode);
    setNewOtpError(err);
    if (err) return;

    setNewOtpVerifying(true);
    setNewEntryError("");
    try {
      const res = await customersApi.verifyNewCustomerOtp(searchedPhone, newOtpCode);
      setNewVerifiedPhone(res.phoneNormalized);
      setNewOtpChallenge(null);
      setNewOtpError("");
    } catch (error) {
      setNewOtpError(error instanceof ApiError ? error.message : "Verification failed. Please try again.");
    } finally {
      setNewOtpVerifying(false);
    }
  }

  async function handleBeginNewCustomerCreation() {
    setNewEntryError("");
    try {
      const res = await customersApi.beginNewCustomerCreation(searchedPhone);
      setNewEntryResult(res);
      navigate("/customers/new");
    } catch (error) {
      setNewEntryError(error instanceof ApiError ? error.message : "Unable to begin account creation.");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-ink">Customer Lookup</h1>
          <p className="mt-1 text-body text-ink/70">
            Search for a caller by telephone number and complete simulated OTP verification before accessing account details.
          </p>
        </div>
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-muted bg-muted px-2.5 py-0.5 text-helper font-semibold text-ink">
          Provisional UI (SCRUM-106 / SCRUM-107)
        </span>
      </header>

      <Card title="Telephone Search">
        <form onSubmit={handleSearch} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Caller telephone number"
              name="phone"
              type="tel"
              required
              placeholder="e.g. 07911 123456 or +44 7911 123456"
              value={phone}
              error={fieldError}
              hint="Supports UK formats (+44, 0044, or leading 0) with spaces or hyphens."
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldError) setFieldError("");
              }}
            />
          </div>
          <Button type="submit" loading={loading} loadingText="Searching…">
            <Icon name="search" size={18} />
            Search
          </Button>
        </form>
      </Card>

      {apiError && (
        <Alert variant="error" title="Search failed">
          {apiError}
        </Alert>
      )}

      {results !== null && results.length === 0 && (
        <Card title="No Matching Account">
          <div className="flex flex-col gap-4">
            <Alert variant="info" title="No Matching Account">
              No existing customer account matched {searchedPhone}. Verify the caller&apos;s telephone number to unlock new-customer account creation.
            </Alert>

            {!newVerifiedPhone ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void handleSendNewCustomerOtp()} loading={newOtpSending} loadingText="Sending…">
                    {newOtpChallenge ? "Resend OTP" : "Send Simulated OTP"}
                  </Button>
                </div>

                {newOtpChallenge && (
                  <Alert variant="info" title="SIMULATION — Telephone OTP (No real SMS sent)">
                    Simulated code for {newOtpChallenge.phone} (valid {newOtpChallenge.expiresInMinutes} min, max {newOtpChallenge.maxAttempts} attempts):{" "}
                    {newOtpChallenge.simulatedCode ? (
                      <strong className="font-mono">{newOtpChallenge.simulatedCode}</strong>
                    ) : (
                      "hidden in production"
                    )}
                  </Alert>
                )}

                {newOtpChallenge && (
                  <form onSubmit={handleVerifyNewCustomerOtp} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <TextField
                        label="Enter OTP"
                        name="newOtpCode"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        placeholder="6-digit code"
                        value={newOtpCode}
                        error={newOtpError}
                        onChange={(e) => {
                          setNewOtpCode(e.target.value);
                          if (newOtpError) setNewOtpError("");
                        }}
                      />
                    </div>
                    <Button type="submit" loading={newOtpVerifying} loadingText="Verifying…">
                      Verify OTP
                    </Button>
                  </form>
                )}

                {!newOtpChallenge && newOtpError && (
                  <Alert variant="error" title="Verification error">
                    {newOtpError}
                  </Alert>
                )}

                <div className="border-t border-muted pt-3">
                  <Button variant="secondary" onClick={() => void handleBeginNewCustomerCreation()}>
                    Begin Account Creation
                  </Button>
                  {newEntryError && (
                    <p className="mt-2 text-helper text-error" role="alert">
                      {newEntryError}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Alert variant="success" title="Verification Successful">
                  New caller telephone ({newVerifiedPhone}) verified. You may now begin new-customer account creation.
                </Alert>
                <div>
                  <Button onClick={() => void handleBeginNewCustomerCreation()}>Begin Account Creation</Button>
                </div>
                {newEntryResult && (
                  <Alert variant="info" title="Verified New-Customer Entry">
                    {newEntryResult.message} (Entry mode: {newEntryResult.entryMode})
                  </Alert>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {results !== null && results.length > 0 && !selected && (
        <Card title={`Matching Customer Accounts (${results.length})`}>
          <ul className="divide-y divide-muted">
            {results.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-ink">{c.fullName}</p>
                  <p className="text-helper text-ink/70">
                    {c.phone ?? "No phone"} · {c.maskedEmail}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => void handleSelectCustomer(c)}>
                  Select customer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {selected && !verifiedProfile && (
        <Card
          title="Selected Customer — Verification Required"
          actions={
            <Button variant="secondary" loading={clearing} loadingText="Clearing…" onClick={() => void handleClearSelection()}>
              Switch customer
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-muted bg-muted/20 p-4">
              <div>
                <p className="text-body font-semibold text-ink">{selected.fullName}</p>
                <p className="text-helper text-ink/70">
                  {selected.phone ?? "No phone"} · {selected.maskedEmail}
                </p>
              </div>
              <span className="inline-flex items-center whitespace-nowrap rounded-full border border-primary-pressed bg-surface px-2.5 py-0.5 text-helper font-semibold text-primary-pressed">
                Unverified Caller
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleSendOtp()} loading={otpSending} loadingText="Sending…">
                {otpChallenge ? "Resend OTP" : "Send Simulated OTP"}
              </Button>
            </div>

            {otpChallenge && (
              <Alert variant="info" title="SIMULATION — Telephone OTP (No real SMS sent)">
                Simulated code for {otpChallenge.phone} (valid {otpChallenge.expiresInMinutes} min, max {otpChallenge.maxAttempts} attempts):{" "}
                {otpChallenge.simulatedCode ? (
                  <strong className="font-mono">{otpChallenge.simulatedCode}</strong>
                ) : (
                  "hidden in production"
                )}
              </Alert>
            )}

            {otpChallenge && (
              <form onSubmit={handleVerifyOtp} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <TextField
                    label="Enter OTP"
                    name="otpCode"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="6-digit code"
                    value={otpCode}
                    error={otpError}
                    onChange={(e) => {
                      setOtpCode(e.target.value);
                      if (otpError) setOtpError("");
                    }}
                  />
                </div>
                <Button type="submit" loading={otpVerifying} loadingText="Verifying…">
                  Verify OTP
                </Button>
              </form>
            )}

            {!otpChallenge && otpError && (
              <Alert variant="error" title="Verification error">
                {otpError}
              </Alert>
            )}
          </div>
        </Card>
      )}

      {selected && verifiedProfile && (
        <>
          <Alert variant="success" title="Verification Successful">
            Caller identity verified for this Staff session. Protected customer account and booking history are now unlocked.
          </Alert>

          <Card
            title="Protected Customer Account"
            actions={
              <Button variant="secondary" loading={clearing} loadingText="Clearing…" onClick={() => void handleClearSelection()}>
                Switch customer
              </Button>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-helper font-semibold text-ink/70 uppercase">Full Name</dt>
                <dd className="text-body text-ink">{verifiedProfile.fullName}</dd>
              </div>
              <div>
                <dt className="text-helper font-semibold text-ink/70 uppercase">Email</dt>
                <dd className="text-body text-ink">{verifiedProfile.email}</dd>
              </div>
              <div>
                <dt className="text-helper font-semibold text-ink/70 uppercase">Telephone</dt>
                <dd className="text-body text-ink">{verifiedProfile.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-helper font-semibold text-ink/70 uppercase">Home Address</dt>
                <dd className="text-body text-ink">{verifiedProfile.homeAddress ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-helper font-semibold text-ink/70 uppercase">Card Last 4</dt>
                <dd className="text-body text-ink">{verifiedProfile.cardLast4 ? `•••• ${verifiedProfile.cardLast4}` : "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Booking History">
            {bookingsLoading && (
              <div className="flex items-center gap-2 text-body text-ink/70">
                <Spinner small label="Loading booking history…" />
                Loading booking history…
              </div>
            )}
            {!bookingsLoading && bookingsError && (
              <Alert variant="error" title="Unable to load booking history">
                {bookingsError}
              </Alert>
            )}
            {!bookingsLoading && !bookingsError && bookings && bookings.length === 0 && (
              <Alert variant="info" title="No bookings found">
                This customer has no bookings on record.
              </Alert>
            )}
            {!bookingsLoading && !bookingsError && bookings && bookings.length > 0 && (
              <ul className="divide-y divide-muted">
                {bookings.map((b) => (
                  <li key={b.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-body font-semibold text-ink">
                        {b.bookingRef} · {b.serviceName}
                      </span>
                      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-muted bg-muted px-2.5 py-0.5 text-helper font-semibold text-ink">
                        {b.status}
                      </span>
                    </div>
                    <p className="text-label text-ink">
                      {b.pickupLocation} → {b.destination}
                    </p>
                    <p className="text-helper text-ink/70">
                      {formatDateTime(b.journeyDateTime, UK_TIME_ZONE)} (UK time) · {b.vehicleSize}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
