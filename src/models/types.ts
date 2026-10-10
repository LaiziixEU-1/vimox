import type { UserStories } from "../services/storyService";

export type Gender = "Femme" | "Homme" | "Non-binaire" | "Autre" | "Tous";

export type VimoXUser = {
  id: string;
  name: string;
  age: number;
  email: string;
  gender: Exclude<Gender, "Tous">;
  country: string;
  profilePhotoURL?: string | null;
  isPremium: boolean;
  activeMatchId?: string;
  blockedUserIds: string[];
  isOnline?: boolean;
  lastSeen?: any;
  bio?: string;
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
  readBy: string[];
  imageURL?: string;
};

export type FriendRequest = {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  fromPhoto?: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

export type Friend = {
  id: string;
  name: string;
  profilePhotoURL?: string | null;
  country: string;
  isPremium: boolean;
  isOnline?: boolean;
  lastSeen?: any;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Matching: undefined;
  ChatRoom: { roomId: string };
  VideoCall: { roomId: string; audioOnly?: boolean };
  AccountSettings: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Legal: { type: "cgu" | "privacy" };
  Premium: undefined;
  Friends: undefined;
  FriendChat: { friendId: string; friendName: string };
  ShareProfile: undefined;
  GameScreen: { chatId: string; gameId: string };
  StoriesFeed: undefined;
  StoryViewer: { stories: UserStories[]; initialUserIndex?: number };
  CreateStory: undefined;
  SendTo: { imageURL: string };
  SnapViewer: {
    imageURL: string;
    chatId: string;
    messageId: string;
    senderName: string;
    senderUid: string;
  };
  CameraDirect: { directSendTo: { friendId: string; friendName: string } };
};
