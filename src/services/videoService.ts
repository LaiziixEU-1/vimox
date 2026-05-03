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
    console.log("WebRTC non disponible dans Expo Go");
  }

  async acceptOffer(
    offer: any,
    onRemoteStream: (stream: any) => void,
  ): Promise<void> {
    console.log("WebRTC non disponible dans Expo Go");
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
    console.log("Appel terminé");
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
