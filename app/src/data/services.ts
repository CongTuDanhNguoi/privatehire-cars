// Mock data: 6 dịch vụ trên màn "2.1 SERVICE SELECTION" (đúng chữ theo thiết kế)
import type { IconName } from "../components/Icon";

export type ServiceId =
  | "local-travel"
  | "long-distance"
  | "airport-transfer"
  | "hotel-transfer"
  | "airport-meet-greet"
  | "daily-hire";

export interface Service {
  id: ServiceId;
  title: string; // tên đầy đủ (Journey Details, test AC-08/09)
  description: string;
  icon: IconName;
  cardTitle: string; // chữ trên thẻ "Select a Service" (thiết kế Sprint 1)
  cardText: string;
}

export const SERVICES: Service[] = [
  { id: "local-travel", title: "Local Travel", description: "Short point-to-point urban rides", icon: "car", cardTitle: "Local Travel", cardText: "Point-to-point urban rides & on-demand pickups" },
  { id: "long-distance", title: "Long-Distance", description: "Inter-city & cross-country journeys", icon: "route", cardTitle: "Long-Distance", cardText: "Comfortable intercity & regional highway travel" },
  { id: "airport-transfer", title: "Airport Transfer", description: "Direct curbside flight connections", icon: "planeTakeoff", cardTitle: "Airport Transfer", cardText: "Flight tracking & curb terminal departures" },
  { id: "hotel-transfer", title: "Hotel Transfer", description: "Seamless luxury luggage handling", icon: "bed", cardTitle: "Hotel Transfer", cardText: "Direct executive luggage & resort pickup" },
  { id: "airport-meet-greet", title: "Airport Meet & Greet", description: "Arrival hall concierge & porterage", icon: "mapPin", cardTitle: "Meet & Greet", cardText: "Inside terminal concierge, luggage & chauffeur escort" },
  { id: "daily-hire", title: "Driver & Car Daily Hire", description: "Private driver and vehicle for a selected hire period.", icon: "armchair", cardTitle: "Daily Chauffeur", cardText: "Full-day dedicated executive driver at your service" },
];

export const findService = (id: string | null | undefined): Service | undefined =>
  SERVICES.find((s) => s.id === id);
