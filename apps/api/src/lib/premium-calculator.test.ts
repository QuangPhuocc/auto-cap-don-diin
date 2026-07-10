import assert from "node:assert";
import { calculateExpectedPremium } from "./premium-calculator.js";

function runTests() {
  console.log("=== Running Premium Calculator Tests ===");

  // Case 1: Non-business passenger car <= 5 seats
  const fee1 = calculateExpectedPremium({
    vehicleType: "XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT",
    seatCount: 5,
    passengerCount: 0,
    passengerFee: 0,
    insuranceYears: 1
  });
  console.log(`Test 1 (Expected 480700): Got ${fee1}`);
  assert.strictEqual(fee1, Math.round(437000 * 1.1));

  // Case 2: Business car <= 5 seats with 5 passengers at 10,000 VND
  const fee2 = calculateExpectedPremium({
    vehicleType: "XE Ô TÔ KD VẬN TẢI",
    seatCount: 5,
    passengerCount: 5,
    passengerFee: 10000,
    insuranceYears: 1
  });
  console.log(`Test 2 (Expected 881600): Got ${fee2}`);
  assert.strictEqual(fee2, Math.round(756000 * 1.1) + 50000);

  // Case 3: Cargo truck under 3 tons, 2 years
  const fee3 = calculateExpectedPremium({
    vehicleType: "XE Ô TÔ CHUYÊN DÙNG Dưới 3 tấn", // specialized vehicle base rate is truck * 1.2
    seatCount: 2,
    passengerCount: 0,
    passengerFee: 0,
    insuranceYears: 2
  });
  const expectedTndsBase = 853000 * 1.2;
  const expectedTotal = Math.round(expectedTndsBase * 1.1) * 2;
  console.log(`Test 3 (Expected ${expectedTotal}): Got ${fee3}`);
  assert.strictEqual(fee3, expectedTotal);

  console.log("✅ All premium calculator tests passed successfully!");
}

try {
  runTests();
} catch (err) {
  console.error("❌ Tests failed:", err);
  process.exit(1);
}
