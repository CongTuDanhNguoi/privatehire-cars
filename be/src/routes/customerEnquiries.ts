// /api/customer/enquiries
import { Router } from "express";
import { requireCustomer } from "../middleware/requireCustomer.js";
import { createEnquiry, listCustomerEnquiries } from "../services/customerEnquiryService.js";
import { parseInput } from "../validation/auth.js";
import { CreateEnquiryBody } from "../validation/enquiries.js";
import type { EnquiryForm } from "../../../src/validation/enquiryValidation";

export const customerEnquiriesRouter = Router();
customerEnquiriesRouter.use(requireCustomer);

customerEnquiriesRouter.post("/", async (req, res) => {
  const body = parseInput(CreateEnquiryBody, req.body);
  const enquiry = await createEnquiry(res.locals.customerId!, {
    ...body,
    type: body.type as EnquiryForm["type"], // checked by validateEnquiry
  });
  res.status(201).json({ enquiry });
});

customerEnquiriesRouter.get("/", async (_req, res) => {
  res.json({ enquiries: await listCustomerEnquiries(res.locals.customerId!) });
});
