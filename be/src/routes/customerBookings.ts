// /api/customer/bookings
import { Router } from "express";
import { requireCustomer } from "../middleware/requireCustomer.js";
import { listCustomerBookings } from "../services/customerEnquiryService.js";

export const customerBookingsRouter = Router();
customerBookingsRouter.use(requireCustomer);

customerBookingsRouter.get("/", async (_req, res) => {
  res.json({ bookings: await listCustomerBookings(res.locals.customerId!) });
});
