import { NextResponse } from "next/server";
import { getMpesaStatus } from "@/lib/mpesa";

export async function GET() {
  const status = getMpesaStatus();
  return NextResponse.json({
    tillNumber: status.tillNumber,
    tillName: status.tillName,
    currency: "KES",
    stkEnabled: status.stkEnabled,
    qrEnabled: status.qrEnabled,
    environment: status.environment,
    instructions: `Open M-Pesa → Lipa na M-Pesa → Buy Goods → Enter Till ${status.tillNumber} → Enter amount → Confirm`,
    manualSteps: [
      "Open M-Pesa on your phone",
      "Select Lipa na M-Pesa",
      "Select Buy Goods",
      `Enter Till Number ${status.tillNumber}`,
      "Enter amount and confirm with your PIN",
    ],
  });
}
