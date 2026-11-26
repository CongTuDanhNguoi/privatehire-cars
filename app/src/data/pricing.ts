// =============================================================
// pricing.ts — Giá chuyến và giảm giá đặt online (dùng chung app + backend).
// Giá tính bằng penny (số nguyên) để tránh sai số làm tròn; hiển thị bằng formatGbp.
// Khóa là nhãn xe lưu trong bookings.vehicle_size (xem backend/src/validation/bookings.ts).
// =============================================================

export const ONLINE_DISCOUNT_PERCENT = 15;

// £95.00 / £135.00. Figma: £135 → giảm £20.25 → còn £114.75.
export const BASE_FARE_PENCE: Record<string, number> = { "Standard Car": 9500, "Seven-Seater": 13500 };

// App vehicle key → label stored in bookings.vehicle_size (same labels as backend/src/validation/bookings.ts).
export const VEHICLE_LABELS: Record<string, string> = { standard: "Standard Car", "seven-seater": "Seven-Seater" };

export interface FareQuote {
  basePence: number;
  discountPence: number;
  totalPence: number;
}

// null khi nhãn xe không có trong bảng giá.
export function quoteFare(
  vehicleLabel: string,
  options: { applyOnlineDiscount?: boolean } = {},
): FareQuote | null {
  const basePence = BASE_FARE_PENCE[vehicleLabel];
  if (basePence === undefined) return null;
  const applyDiscount = options.applyOnlineDiscount ?? true;
  const discountPence = applyDiscount ? Math.round((basePence * ONLINE_DISCOUNT_PERCENT) / 100) : 0;
  return { basePence, discountPence, totalPence: basePence - discountPence };
}

export const formatGbp = (pence: number): string => `£${(pence / 100).toFixed(2)}`;
