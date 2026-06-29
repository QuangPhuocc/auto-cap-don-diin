import type { Policy } from "@prisma/client";

export type IssuedPolicyResult = {
  customerName: string;
  plateNumber: string;
  chassisNumber?: string;
  engineNumber?: string;
  certificateNumber?: string;
  serialNumber?: string;
  premium?: number;
  pdfUrl?: string;
  pdfPath?: string;
};

export type SinglePolicyRecord = Pick<
  Policy,
  | "customerName"
  | "phone"
  | "address"
  | "plateNumber"
  | "chassisNumber"
  | "engineNumber"
  | "vehicleType"
  | "seatCount"
  | "effectiveDate"
  | "gender"
  | "passengerCount"
  | "passengerFee"
  | "email"
  | "insuranceYears"
  | "agent"
>;
