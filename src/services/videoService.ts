export type VideoSession = {
  roomId: string;
  userId: string;
  provider: "webrtc" | "agora";
};

export class VideoCallService {
  private roomId: string;
  private myUid: string;
  private isMuted = false;
  private isCameraOff = false;

  constructor(roomId: string, myUid: string) {
    this.roomId = roomId;
    this.myUid = myUid;
  }

  async getLocalStream(): Promise<null> {
    return null;
  }

  async createOffer(onRemoteStream: (stream: any) => void): Promise<void> {
    // WebRTC natif indisponible dans Expo Go : les appels passent par la salle Jitsi
  }

  async acceptOffer(
    offer: any,
    onRemoteStream: (stream: any) => void,
  ): Promise<void> {
    // WebRTC natif indisponible dans Expo Go : les appels passent par la salle Jitsi
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  toggleCamera(): boolean {
    this.isCameraOff = !this.isCameraOff;
    return this.isCameraOff;
  }

  switchToAudioOnly(): void {
    this.isCameraOff = true;
  }

  async hangUp(): Promise<void> {
    // rien à libérer : la salle Jitsi se ferme avec l'écran
  }
}

export async function startVideoSession(
  roomId: string,
  userId: string,
): Promise<VideoSession> {
  return { roomId, userId, provider: "webrtc" };
}

export async function stopVideoSession() {
  return true;
}

// ─────────────────────────────────────────────────────────────
// Appels réels dans Expo Go : une salle Jitsi Meet affichée dans une WebView
// (WebRTC natif exigerait un build personnalisé). Pour utiliser ton propre serveur
// (Jitsi auto-hébergé, JaaS...), change simplement CALL_SERVER.
// ─────────────────────────────────────────────────────────────
// Configurable dans .env (EXPO_PUBLIC_CALL_SERVER) : le serveur public meet.jit.si peut exiger une
// connexion Google/GitHub pour démarrer un appel et limite l'usage commercial ; pour une vraie
// publication, utilise ton propre serveur Jitsi (voir COUTS-ET-COMPTES.md).
export const CALL_SERVER = (process.env.EXPO_PUBLIC_CALL_SERVER ?? "").trim() || "https://meet.jit.si";

// Le nom de la salle contient l'identifiant (aléatoire, impossible à deviner) de la conversation :
// seules les deux personnes de la conversation peuvent la rejoindre.
export function callRoomName(roomId: string): string {
  return `VimoX${roomId.replace(/[^A-Za-z0-9]/g, "")}`;
}

export function buildCallUrl(
  roomId: string,
  displayName: string,
  audioOnly: boolean,
  server: string = CALL_SERVER,
): string {
  const options = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    `config.startWithVideoMuted=${audioOnly}`,
    `config.startAudioOnly=${audioOnly}`,
    "config.startWithAudioMuted=false",
    "config.disableInviteFunctions=true",
    "config.enableWelcomePage=false",
    "interfaceConfig.MOBILE_APP_PROMO=false",
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName || "VimoX"))}`,
  ];
  return `${server}/${callRoomName(roomId)}#${options.join("&")}`;
}

// Le module react-native-webview est optionnel : sans lui, l'appli garde l'ancien écran d'appel
export function getWebViewComponent(): any {
  try {
    return require("react-native-webview").WebView;
  } catch {
    return null;
  }
}
