// Unsent reply for one enquiry, kept in sessionStorage so a refresh or a quick look at another page does not lose it.
import { useCallback, useEffect, useState } from "react";
import { readSession, removeSession, writeSession } from "../../lib/storage";

export interface Draft {
  subject: string;
  body: string;
}

const keyFor = (enquiryId: number) => `phc_staff_draft_${enquiryId}`;

export function useDraft(enquiryId: number, defaultSubject: string) {
  const [draft, setDraft] = useState<Draft>(
    () => readSession<Draft>(keyFor(enquiryId)) ?? { subject: defaultSubject, body: "" },
  );

  const isDirty = draft.body.trim() !== "" || draft.subject.trim() !== defaultSubject.trim();

  useEffect(() => {
    if (isDirty) writeSession(keyFor(enquiryId), draft);
    else removeSession(keyFor(enquiryId));
  }, [draft, isDirty, enquiryId]);

  const clear = useCallback(() => {
    removeSession(keyFor(enquiryId));
    setDraft({ subject: defaultSubject, body: "" });
  }, [enquiryId, defaultSubject]);

  return { draft, setDraft, isDirty, clear };
}
