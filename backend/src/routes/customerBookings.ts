// /api/customer/bookings
import { Router } from "express";
import { requireCustomer } from "../middleware/requireCustomer.js";
import { createCustomerBooking, listCustomerBookings } from "../services/customerEnquiryService.js";
import { parseInput } from "../validation/auth.js";
import { CreateBookingBody } from "../validation/bookings.js";

export const customerBookingsRouter = Router();
customerBookingsRouter.use(requireCustomer);

customerBookingsRouter.get("/", async (_req, res) => {
  res.json({ bookings: await listCustomerBookings(res.locals.customerId!) });
});

// Saves the trip once a vehicle is available (201 new, 200 when the same trip was already saved).
customerBookingsRouter.post("/", async (req, res) => {
  const body = parseInput(CreateBookingBody, req.body);
  const { booking, created } = await createCustomerBooking(res.locals.customerId!, body);
  res.status(created ? 201 : 200).json({ booking });
});
