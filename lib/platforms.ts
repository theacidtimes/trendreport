import { AtSign, Camera, MessageSquare, Music2, Newspaper } from "lucide-react";

export type Plataforma = "instagram" | "twitter" | "tiktok" | "reddit" | "news";

export const PLATFORM_LABEL: Record<Plataforma, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
  tiktok: "TikTok",
  reddit: "Reddit",
  news: "Notícias",
};

export const PLATFORM_ICON: Record<Plataforma, typeof Camera> = {
  instagram: Camera,
  twitter: AtSign,
  tiktok: Music2,
  reddit: MessageSquare,
  news: Newspaper,
};

export const PLATFORM_ACCENT: Record<Plataforma, string> = {
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  tiktok: "#25F4EE",
  reddit: "#FF4500",
  news: "#9b8faa",
};
