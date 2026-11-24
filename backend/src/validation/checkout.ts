// Request schema for paying a saved trip (POST /api/customer/bookings/:ref/pay).
// The phone rule itself lives in app/src/validation/checkoutValidation.ts.
import { z } from "zod";

export const PayBookingBody = z.object({ phone: z.string().default("") });
