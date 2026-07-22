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
  mood_emoji: string | null;
  mood_text: string | null;
  mood_set_at: string | null;
};

export type NearbyProfile = Pick<
  Profile,
  | "id"
  | "name"
  | "initials"
  | "avatar_bg"
  | "avatar_fg"
  | "area"
  | "interests"
  | "last_seen"
  | "mood_emoji"
  | "mood_text"
> & { distance_km: number };

// Quick-set vibe options shown on the profile page — short and screenshot-able,
// the way a Gen Z status/mood picker should feel.
export const VIBE_OPTIONS: { emoji: string; text: string }[] = [
  { emoji: "👀", text: "down to hang" },
  { emoji: "📚", text: "studying" },
  { emoji: "🎮", text: "gaming" },
  { emoji: "☕", text: "coffee run?" },
  { emoji: "🏃", text: "on a walk" },
  { emoji: "🎧", text: "in my zone" },
  { emoji: "🍜", text: "hungry, send food" },
  { emoji: "✨", text: "just vibing" },
];

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  responded_at: string | null;
  streak_count: number;
  last_interaction_date: string | null;
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

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg">;
};

export const REACTION_EMOJIS = ["🔥", "❤️", "😂", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

export type PostWithMeta = Post & {
  author: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg">;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  comments: PostComment[];
  reaction_counts: ReactionCounts;
  my_reaction: ReactionEmoji | null;
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
  general: { label: "General", bg: "rgba(124,92,252,0.14)", col: "#C9B8FF" },
  help: { label: "Help", bg: "rgba(255,194,75,0.14)", col: "#FFC24B" },
  found: { label: "Found", bg: "rgba(255,122,89,0.14)", col: "#FF7A59" },
  social: { label: "Social", bg: "rgba(232,67,147,0.14)", col: "#E84393" },
  sell: { label: "Buy/Sell", bg: "rgba(51,230,160,0.14)", col: "#33E6A0" },
};
