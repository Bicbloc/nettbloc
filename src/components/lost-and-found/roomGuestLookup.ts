import { fetchPmsRooms, todayDate } from "@/services/breakfastConfigService";

export interface RoomGuestInfo {
  firstName?: string;
  lastName?: string;
  checkIn?: string;
  checkOut?: string;
  type?: "arrival" | "departure" | "staying";
}

export interface RoomGuestOption {
  key: "arrival" | "departure" | "staying";
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

  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" "),
  };
};

const getGuestKeyFromStatus = (status: string | null): RoomGuestOption["key"] => {
  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus.includes("depart") || normalizedStatus.includes("checkout")) {
    return "departure";
  }

  if (normalizedStatus.includes("arrival")) {
    return "arrival";
  }

  return "staying";
};

const getGuestLabel = (key: RoomGuestOption["key"]) => {
  if (key === "departure") return "Départ (check-out)";
  if (key === "arrival") return "Arrivée";
  return "En cours (séjour)";
};

export async function fetchRoomGuestOptions(hotelId: string, roomNumber: string): Promise<RoomGuestOption[]> {
  const normalizedRoom = normalizeRoomNumber(roomNumber);
  if (!hotelId || !normalizedRoom) return [];

  const response = await fetchPmsRooms(hotelId);
  if (!response.ok) return [];

  const seen = new Set<string>();
  const orderedKeys: RoomGuestOption["key"][] = ["departure", "staying", "arrival"];

  const options = response.rooms
    .filter((room) => normalizeRoomNumber(room.room_number) === normalizedRoom)
    .map((room) => {
      const key = getGuestKeyFromStatus(room.status);
      const name = parseGuestName(room.guest_name);

      return {
        key,
        label: getGuestLabel(key),
        info: {
          firstName: name.firstName,
          lastName: name.lastName,
          checkIn: key === "arrival" ? todayDate() : "",
          checkOut: key === "departure" ? todayDate() : "",
          type: key,
        },
      } satisfies RoomGuestOption;
    })
    .filter((option) => option.info.firstName || option.info.lastName)
    .filter((option) => {
      const dedupeKey = `${option.key}:${option.info.firstName || ""}:${option.info.lastName || ""}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((a, b) => orderedKeys.indexOf(a.key) - orderedKeys.indexOf(b.key));

  return options;
}