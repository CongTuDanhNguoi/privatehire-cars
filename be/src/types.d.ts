// Values the auth middleware puts on res.locals.
declare global {
  namespace Express {
    interface Locals {
      staffId?: number;
      customerId?: number;
      sessionIssuedAt?: Date;
    }
  }
}

export {};
