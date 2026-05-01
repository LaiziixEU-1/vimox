export type VideoSession = {
  roomId: string;
  userId: string;
  provider: "webrtc" | "agora";
};

export async function startVideoSession(roomId: string, userId: string): Promise<VideoSession> {
  return {
    roomId,
    userId,
    provider: "webrtc"
  };
}

export async function stopVideoSession() {
  return true;
}

