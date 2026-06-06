import { fetchPmsRoomGuests } from "@/services/breakfastConfigService";

export interface RoomGuestInfo {
  firstName?: string;
  lastName?: string;
  checkIn?: string;
  checkOut?: string;
  type?: "arrival" | "departure" | "staying" | "checked_out";
}

export interface RoomGuestOption {
  key: "arrival" | "departure" | "staying" | "checked_out";
  label: string;
  info: RoomGuestInfo;
}

const normalizeRoomNumber = (value: string) => value.trim().toLowerCase();

const parseGuestName = (guestName: string | null) => {
  const cleaned = guestName?.trim() || "";
  if (!cleaned) return { firstName: "", lastName: "" };

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }

  // Mews/Apaleo renvoient "Nom Prénom" → le dernier mot est le prénom.
  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" "),
  };
};

const mapStatusToKey = (status: string | null): RoomGuestOption["key"] => {
  const s = (status || "").toLowerCase();
  if (s.includes("checked_out") || s.includes("checkout") || s.includes("depart")) {
    return s.includes("depart") && !s.includes("checked_out") ? "departure" : "checked_out";
  }
  if (s === "departure") return "departure";
  if (s === "arrival") return "arrival";
  return "staying";
};

const getGuestLabel = (key: RoomGuestOption["key"]) => {
  if (key === "checked_out") return "Parti (check-out)";
  if (key === "departure") return "Départ aujourd'hui";
  if (key === "arrival") return "Arrivée";
  return "En cours (séjour)";
};

export async function fetchRoomGuestOptions(
  hotelId: string,
  roomNumber: string,
): Promise<RoomGuestOption[]> {
  const normalizedRoom = normalizeRoomNumber(roomNumber);
  if (!hotelId || !normalizedRoom) return [];

  const response = await fetchPmsRoomGuests(hotelId);
  if (!response.ok) return [];

  const seen = new Set<string>();
  // Priorité d'affichage : parti récemment > départ du jour > en séjour > arrivée.
  const orderedKeys: RoomGuestOption["key"][] = ["checked_out", "departure", "staying", "arrival"];

  const options = response.guests
    .filter((g) => normalizeRoomNumber(g.room_number) === normalizedRoom)
    .map((g) => {
      const key = mapStatusToKey(g.status);
      const name = parseGuestName(g.guest_name);
      return {
        key,
        label: getGuestLabel(key),
        info: {
          firstName: name.firstName,
          lastName: name.lastName,
          checkIn: g.check_in || "",
          checkOut: g.check_out || "",
          type: key,
        },
      } satisfies RoomGuestOption;
    })
    .filter((option) => option.info.firstName || option.info.lastName)
    .filter((option) => {
      const dedupeKey = `${option.key}:${option.info.firstName || ""}:${option.info.lastName || ""}:${option.info.checkOut || ""}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((a, b) => orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key));

  return options;
}
