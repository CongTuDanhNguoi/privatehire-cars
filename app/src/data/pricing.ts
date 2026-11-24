// =============================================================
// pricing.ts — Giá chuyến và giảm giá đặt online (dùng chung app + backend).
// Giá tính bằng penny (số nguyên) để tránh sai số làm tròn; hiển thị bằng formatGbp.
// Khóa là nhãn xe lưu trong bookings.vehicle_size (xem backend/src/validation/bookings.ts).
// =============================================================

export const ONLINE_DISCOUNT_PERCENT = 15;

// £95.00 / £135.00. Figma: £135 → giảm £20.25 → còn £114.75.
export const BASE_FARE_PENCE: Record<string, number> = { "Standard Car": 9500, "Seven-Seater": 13500 };

export interface FareQuote {
  basePence: number;
  discountPence: number;
  totalPence: number;
}

// null khi nhãn xe không có trong bảng giá.
export function quoteFare(vehicleLabel: string): FareQuote | null {
  const basePence = BASE_FARE_PENCE[vehicleLabel];
  if (basePence === undefined) return null;
  const discountPence = Math.round((basePence * ONLINE_DISCOUNT_PERCENT) / 100);
  return { basePence, discountPence, totalPence: basePence - discountPence };
}

export const formatGbp = (pence: number): string => `£${(pence / 100).toFixed(2)}`;
