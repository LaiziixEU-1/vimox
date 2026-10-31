import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import { buildFaceLensHtml } from './faceLensHtml';

export type FaceLensHandle = {
  /** Photo avec l'effet incrusté (fichier local), ou null si pas prêt. */
  takePhoto: () => Promise<string | null>;
  /** audio: false = sans micro (quand un son est choisi, comme sur Snap) */
  startRecording: (opts?: { audio?: boolean }) => Promise<void>;
  /** Vidéo avec l'effet incrusté (fichier local), 15 s maximum. */
  stopRecording: () => Promise<string | null>;
};

type Props = {
  effect: string;
  facing: 'front' | 'back';
};

let counter = 0;
const nextId = () => `${Date.now()}_${++counter}`;

function writeBase64(data: string, ext: string): string {
  const file = new File(Paths.cache, `vimox-ar-${Date.now()}.${ext}`);
  file.write(data, { encoding: 'base64' });
  return file.uri;
}

/**
 * Effets qui suivent le visage, gratuits, et qui marchent dans Expo Go :
 * la caméra et la détection du visage (MediaPipe de Google) tournent dans une WebView.
 * Le premier chargement télécharge ~10 Mo (puis c'est en cache).
 */
export const FaceLensView = forwardRef<FaceLensHandle, Props>(function FaceLensView({ effect, facing }, ref) {
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const pending = useRef(new Map<string, (msg: any) => void>());
  const [status, setStatus] = useState<'loading' | 'camera' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // La page est créée une seule fois ; les changements passent ensuite par des commandes
  const html = useMemo(() => buildFaceLensHtml(effect, facing), []);

  const send = (cmd: object) => {
    web.current?.injectJavaScript(`window.vx && window.vx.cmd(${JSON.stringify(cmd)}); true;`);
  };

  const request = (cmd: { type: string }, timeoutMs: number) =>
    new Promise<any>((resolve) => {
      const id = nextId();
      const timer = setTimeout(() => {
        pending.current.delete(id);
        resolve(null);
      }, timeoutMs);
      pending.current.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ ...cmd, id });
    });

  useEffect(() => {
    send({ type: 'effect', effect });
  }, [effect]);

  useEffect(() => {
    send({ type: 'facing', facing });
  }, [facing]);

  useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      const msg = await request({ type: 'photo' }, 8000);
      if (!msg?.data) return null;
      return writeBase64(msg.data, 'jpg');
    },
    startRecording: async (opts?: { audio?: boolean }) => {
      const msg = await request({ type: 'startRec', audio: opts?.audio !== false } as { type: string }, 8000);
      if (!msg || msg.error) throw new Error(msg?.error ?? 'Enregistrement impossible');
    },
    stopRecording: async () => {
      const msg = await request({ type: 'stopRec' }, 30000);
      if (!msg?.data) return null;
      return writeBase64(msg.data, msg.mime === 'video/mp4' ? 'mp4' : 'webm');
    },
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.id && pending.current.has(msg.id)) {
      const resolve = pending.current.get(msg.id)!;
      pending.current.delete(msg.id);
      resolve(msg);
      return;
    }
    if (msg.type === 'camera') setStatus((s) => (s === 'ready' ? s : 'camera'));
    else if (msg.type === 'ready') setStatus('ready');
    else if (msg.type === 'error') {
      setStatus('error');
      setError(String(msg.message ?? 'Erreur'));
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={web}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        style={styles.web}
        containerStyle={styles.web}
      />
      {status !== 'ready' && (
        <View style={styles.status}>
          {status === 'error' ? (
            <Text style={styles.statusTxt}>{error}</Text>
          ) : (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.statusTxt}>
                {status === 'loading' ? 'Ouverture de la caméra…' : 'Chargement de l’effet…'}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
  status: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '85%',
  },
  statusTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
