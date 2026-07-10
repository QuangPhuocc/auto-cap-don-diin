/**
 * Premium Calculator for VASS/DIIN TNDS BB Insurance
 *
 * Implements Ministry of Finance standard TNDS base rates (Circular 04/2021/TT-BTC & Decree 67/2023/NĐ-CP).
 * Base rates are VAT-exclusive (VAT 10% is added at final calculation).
 * NNTX (accident insurance for passengers) is VAT-exempt (VAT 0%).
 */

// Base rates in VND (excluding VAT)
const TARIFFS: Record<string, number | ((seats: number) => number)> = {
  "XE BUÝT": 437000,
  "XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT": (seats: number) => {
    if (seats <= 5) return 437000;
    if (seats <= 11) return 794000;
    if (seats <= 24) return 1270000;
    return 1825000;
  },
  "XE Ô TÔ KD VẬN TẢI": (seats: number) => {
    if (seats <= 5) return 756000;
    if (seats === 6) return 929000;
    if (seats === 7) return 1080000;
    if (seats === 8) return 1253000;
    if (seats === 15) return 2752000;
    if (seats === 25) return 4813000;
    // Over 25 seats: 4,813,000 + 30,000 per extra seat
    if (seats > 25) return 4813000 + (seats - 25) * 30000;
    return 756000; // default fallback
  },
  "XE TAXI": (seats: number) => {
    // Taxi is 170% of business passenger car rate
    if (seats <= 5) return 756000 * 1.7;
    if (seats === 6) return 929000 * 1.7;
    if (seats === 7) return 1080000 * 1.7;
    if (seats === 8) return 1253000 * 1.7;
    return 756000 * 1.7; // default fallback
  },
  // Trucks (Xe tải)
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Kinh doanh)": 853000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Kinh doanh)": 1660000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 8 đến 15 tấn (Kinh doanh)": 2746000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 15 tấn (Kinh doanh)": 3200000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Dưới 3 tấn (Không kinh doanh)": 853000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Từ 3 đến 8 tấn (Không kinh doanh)": 1660000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 8 đến 15 tấn (Không kinh doanh)": 2746000,
  "XE Ô TÔ CHỞ HÀNG, XE TẢI Trên 15 tấn (Không kinh doanh)": 3200000,
  
  // Pickups/Minivans
  "Vừa chở hàng và người (Mini van, Pickup) Không KD": 437000,
  "Vừa chở hàng và người (Mini van, Pickup) Kinh doanh": 437000 * 1.1, // or same rate
  
  // Đầu kéo
  "XE ĐẦU KÉO các loại (Kinh doanh)": 4800000,
  "XE ĐẦU KÉO các loại (Không KD)": 4800000,
  "XE ĐẦU KÉO tập lái các loại": 4800000,

  // Chuyên dùng
  "XE Ô TÔ CHUYÊN DÙNG Dưới 3 tấn": 853000 * 1.2,
  "XE Ô TÔ CHUYÊN DÙNG Từ 3 đến 8 tấn": 1660000 * 1.2,
  "XE Ô TÔ CHUYÊN DÙNG Trên 8 đến 15 tấn": 2746000 * 1.2,
  "XE Ô TÔ CHUYÊN DÙNG Trên 15 tấn": 3200000 * 1.2,
  "XE Ô TÔ CHUYÊN DÙNG Xe cứu thương": 1270000 * 1.2,
  "XE Ô TÔ CHUYÊN DÙNG Xe chở tiền": 794000 * 1.2,

  // Tập lái
  "XE TẬP LÁI (CHỞ NGƯỜI)": 437000 * 1.2,
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Dưới 3 tấn": 853000 * 1.2,
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Từ 3 đến 8 tấn": 1660000 * 1.2,
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Trên 8 đến 15 tấn": 2746000 * 1.2,
  "XE TẬP LÁI CHỞ HÀNG (XE TẢI) Trên 15 tấn": 3200000 * 1.2
};

export function calculateExpectedPremium(params: {
  vehicleType: string;
  seatCount?: number;
  passengerCount?: number;
  passengerFee?: number;
  insuranceYears?: number;
}): number {
  const years = params.insuranceYears ?? 1;
  const seats = params.seatCount ?? 5;
  const pCount = params.passengerCount ?? 0;
  const pFee = params.passengerFee ?? 0;
  const typeKey = params.vehicleType.toUpperCase().trim();

  // Find base rate
  let baseRate = 437000; // standard default (Xe con không KD)
  
  // Custom exact matching or substring matching
  const matchedKey = Object.keys(TARIFFS).find(k => k.toUpperCase() === typeKey || typeKey.includes(k.toUpperCase()));
  if (matchedKey) {
    const tariff = TARIFFS[matchedKey];
    if (typeof tariff === "function") {
      baseRate = tariff(seats);
    } else {
      baseRate = tariff;
    }
  } else {
    // Substring fallback checks
    if (typeKey.includes("TAXI")) {
      baseRate = 756000 * 1.7;
    } else if (typeKey.includes("ĐẦU KÉO")) {
      baseRate = 4800000;
    } else if (typeKey.includes("TẢI") || typeKey.includes("CHỞ HÀNG")) {
      if (typeKey.includes("DƯỚI 3 TẤN")) baseRate = 853000;
      else if (typeKey.includes("TỪ 3 ĐẾN 8 TẤN")) baseRate = 1660000;
      else if (typeKey.includes("TRÊN 8 ĐẾN 15 TẤN")) baseRate = 2746000;
      else baseRate = 3200000;
    } else if (typeKey.includes("KHÔNG KD") || typeKey.includes("KHÔNG KINH DOANH")) {
      const fn = TARIFFS["XE Ô TÔ KHÔNG KD VẬN TẢI & XE BUÝT"] as (seats: number) => number;
      baseRate = fn(seats);
    } else if (typeKey.includes("KD") || typeKey.includes("KINH DOANH")) {
      const fn = TARIFFS["XE Ô TÔ KD VẬN TẢI"] as (seats: number) => number;
      baseRate = fn(seats);
    }
  }

  // Calculate expected total
  const tndsBeforeTax = baseRate;
  const tndsWithTax = Math.round(tndsBeforeTax * 1.1);
  const nntxFee = pCount * pFee;

  return (tndsWithTax + nntxFee) * years;
}
