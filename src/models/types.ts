/*VIMOX-V30*/
/*VIMOX-V29*/
/*VIMOX-V16*/
/*VIMOX-V11*/
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
  // Réglages du compte (Paramètres)
  showOnlineStatus?: boolean;
  // Apparaître dans la recherche et les suggestions (par défaut : oui si adulte, non si moins de 18 ans)
  discoverable?: boolean;
  // Pseudo unique (en minuscules, sans le @) : voir usernameService
  username?: string;
  notifPush?: boolean;
  notifSounds?: boolean;
  notifPreview?: boolean;
  autoTranslate?: boolean;
  pushToken?: string;
  // Posés par le serveur (jamais modifiables par l'utilisateur) : suspension après signalements
  suspendedUntil?: any;
  reportCount?: number;
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
  LensCamera: undefined;
  Login: undefined;
  Register: undefined;
  Matching: undefined;
  // video : match en mode vidéo, l'appel s'ouvre tout seul
  ChatRoom: { roomId: string; video?: boolean };
  // roomId = nom de la salle d'appel ; « friend » : appel avec un ami (messages dans friendChats)
  VideoCall: {
    roomId: string;
    audioOnly?: boolean;
    joining?: boolean;
    friend?: { cid: string; friendId: string; friendName: string };
  };
  AccountSettings: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Legal: { type: "cgu" | "privacy" };
  Premium: undefined;
  Friends: undefined;
  AddFriends: undefined;
  NewChat: undefined;
  NewShortcut: undefined;
  ManageChats: undefined;
  ManageFriends: undefined;
  BestFriendEmojis: undefined;
  GroupChat: { groupId: string; name?: string };
  RecentMatches: undefined;
  NewGroup: undefined;
  FriendChat: { friendId: string; friendName: string };
  ShareProfile: undefined;
  UserProfile: { userId: string };
  GameScreen: { chatId: string; gameId: string };
  StoriesFeed: undefined;
  StoryViewer: { stories: UserStories[]; initialUserIndex?: number };
  CreateStory: undefined;
  SendTo: { imageURL: string; duration?: number };
  SnapViewer: { groupId?: string;
    imageURL: string;
    chatId: string;
    messageId: string;
    senderName: string;
    senderUid: string;
    duration?: number;
  };
  CameraDirect: {
    directSendTo?: { friendId: string; friendName: string };
    directSendToRoom?: { roomId: string; partnerName: string };
  };
};
