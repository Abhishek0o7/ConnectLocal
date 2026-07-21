export type Profile = {
  id: string;
  name: string;
  initials: string;
  avatar_bg: string;
  avatar_fg: string;
  area: string;
  city: string;
  lat: number | null;
  lng: number | null;
  interests: string[];
  bio: string;
  last_seen: string;
  created_at: string;
};

export type NearbyProfile = Pick<
  Profile,
  "id" | "name" | "initials" | "avatar_bg" | "avatar_fg" | "area" | "interests" | "last_seen"
> & { distance_km: number };

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  responded_at: string | null;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export type PostTag = "general" | "help" | "found" | "social" | "sell";

export type Post = {
  id: string;
  author_id: string;
  tag: PostTag;
  content: string;
  created_at: string;
};

export type PostWithMeta = Post & {
  author: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg">;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type EventRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  created_at: string;
};

export type EventRequestStatus = "pending" | "accepted" | "declined";

export type EventRequest = {
  id: string;
  event_id: string;
  user_id: string;
  status: EventRequestStatus;
  created_at: string;
  responded_at: string | null;
};

export type EventWithMeta = EventRow & {
  host: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg">;
  going_count: number;
  my_request_status: EventRequestStatus | "none";
};

export const TAG_STYLES: Record<PostTag, { label: string; bg: string; col: string }> = {
  general: { label: "General", bg: "#f0f0f8", col: "#534AB7" },
  help: { label: "Help", bg: "#FAEEDA", col: "#854F0B" },
  found: { label: "Found", bg: "#FAECE7", col: "#993C1D" },
  social: { label: "Social", bg: "#FBEAF0", col: "#993556" },
  sell: { label: "Buy/Sell", bg: "#EAF3DE", col: "#3B6D11" },
};
