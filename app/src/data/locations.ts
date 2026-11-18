// =============================================================
// locations.ts — địa điểm mẫu (Manchester) theo thiết kế Sprint 1:
//   "2. Pickup Location Search", "3. Destination Search", "4. Set Location on Map".
// group: "recent" = RECENT & SAVED, "hub" = SUGGESTED HUBS. tag: nhãn nhỏ cạnh tên (HOME, WORK, MAN, Rail).
// =============================================================
import type { IconName } from "../components/Icon";

export interface MockLocation {
  id: string;
  name: string;
  address: string;
  postcode: string;
  category: "station" | "airport" | "hotel" | "district" | "stadium" | "landmark" | "home" | "work";
  note?: string;
  isRecent?: boolean;
  group: "recent" | "hub";
  tag?: string;
  icon: IconName;
}

export const PICKUP_SUGGESTIONS: MockLocation[] = [
  {
    id: "man-piccadilly",
    name: "Manchester Piccadilly Station",
    address: "Station Approach, M1 2PB",
    postcode: "M1 2PB",
    category: "station",
    note: "Driver will meet passenger at Station Car Park Pick-up Zone",
    isRecent: true,
    group: "recent",
    icon: "train",
  },
  {
    id: "park-avenue",
    name: "42 Park Avenue",
    address: "Manchester, M14 5RT",
    postcode: "M14 5RT",
    category: "home",
    note: "Pick-up from the front door",
    group: "recent",
    tag: "HOME",
    icon: "house",
  },
  {
    id: "mediacity",
    name: "MediaCityUK",
    address: "Salford, M50 2EQ",
    postcode: "M50 2EQ",
    category: "work",
    note: "Pick-up at the Orange Tower drop-off bay",
    group: "recent",
    tag: "WORK",
    icon: "building",
  },
  {
    id: "man-airport-hub",
    name: "Manchester Airport Terminal",
    address: "Ringway, M90 3WN",
    postcode: "M90 3WN",
    category: "airport",
    note: "Curbside collection directly outside the terminal forecourt",
    group: "hub",
    tag: "MAN",
    icon: "planeLanding",
  },
  {
    id: "man-victoria",
    name: "Manchester Victoria Station",
    address: "Station Approach, M3 1WY",
    postcode: "M3 1WY",
    category: "station",
    note: "Driver will meet passenger at the Todd Street entrance",
    group: "hub",
    tag: "Rail",
    icon: "train",
  },
];

export const DESTINATION_SUGGESTIONS: MockLocation[] = [
  {
    id: "man-t2",
    name: "Manchester Airport Terminal 2",
    address: "Ringway, M90 4FP",
    postcode: "M90 4FP",
    category: "airport",
    note: "Drop-off located directly outside Departures Upper Forecourt",
    isRecent: true,
    group: "recent",
    icon: "planeTakeoff",
  },
  {
    id: "lowry-hotel",
    name: "The Lowry Hotel",
    address: "50 Dearmans Place, Salford, M3 5LH",
    postcode: "M3 5LH",
    category: "hotel",
    note: "Drop-off at the hotel main entrance",
    group: "recent",
    icon: "bed",
  },
  {
    id: "etihad",
    name: "Etihad Stadium",
    address: "Ashton New Rd, Manchester, M11 3FF",
    postcode: "M11 3FF",
    category: "stadium",
    note: "Drop-off at the Joe Mercer Way coach bay",
    group: "recent",
    icon: "building",
  },
  {
    id: "man-airport-t1",
    name: "Manchester Airport (MAN)",
    address: "Terminal 1",
    postcode: "M90 1QX",
    category: "airport",
    note: "Drop-off at Terminal 1 departures forecourt",
    group: "hub",
    icon: "planeLanding",
  },
  {
    id: "man-piccadilly-dest",
    name: "Manchester Piccadilly Station",
    address: "Station Approach, M1 2PB",
    postcode: "M1 2PB",
    category: "station",
    note: "Drop-off at the Station Approach taxi rank",
    group: "hub",
    icon: "train",
  },
];

// Tìm theo tên, địa chỉ, mã bưu chính hoặc loại địa điểm.
export function searchLocations(query: string, mode: "pickup" | "destination" = "pickup"): MockLocation[] {
  const baseList = mode === "pickup" ? PICKUP_SUGGESTIONS : DESTINATION_SUGGESTIONS;
  const q = (query || "").trim().toLowerCase();
  if (!q) return baseList;
  return baseList.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.address.toLowerCase().includes(q) ||
      loc.postcode.toLowerCase().includes(q) ||
      loc.category.toLowerCase().includes(q),
  );
}
