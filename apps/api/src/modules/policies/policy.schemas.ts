import { z } from "zod";

export const singlePolicySchema = z.object({
  customerName: z.string().min(2).max(255),
  phone: z.string().max(30).optional().nullable().or(z.literal("")),
  address: z.string().min(2).max(1000),
  plateNumber: z.string().min(3).max(50).transform((v) => v.trim().toUpperCase()),
  chassisNumber: z.string().min(3).max(100).transform((v) => v.trim().toUpperCase()),
  engineNumber: z.string().min(3).max(100).transform((v) => v.trim().toUpperCase()),
  vehicleType: z.string().min(2).max(255),
  seatCount: z.coerce.number().int().min(1).max(100).optional(),
  effectiveDate: z.coerce.date(),
  gender: z.enum(["NAM", "NỮ"]).default("NAM"),
  passengerCount: z.coerce.number().int().min(0).max(100).default(0),
  passengerFee: z.coerce.number().int().default(0),
  email: z.string().email().optional().or(z.literal("")),
  agent: z.string().optional().nullable(),
  issuerName: z.string().optional().nullable(),
  insuranceYears: z.coerce.number().int().min(1).max(3).default(1)
});

export type SinglePolicyInput = z.infer<typeof singlePolicySchema>;
