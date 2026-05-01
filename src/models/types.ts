export type Gender = "Femme" | "Homme" | "Non-binaire" | "Autre" | "Tous";

export type VimoXUser = {
  id: string;
  name: string;
  age: number;
  email: string;
  gender: Exclude<Gender, "Tous">;
  country: string;
  profilePhotoURL?: string;
  isPremium: boolean;
  activeMatchId?: string;
  blockedUserIds: string[];
};

export type MatchFilters = {
  minAge: number;
  maxAge: number;
  gender: Gender;
  country: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  sentAt: number;
  isAbusive: boolean;
};

export type RootStackParamList = {
  Register: undefined;
  Matching: undefined;
  ChatRoom: { roomId: string };
  VideoCall: { roomId: string };
};

