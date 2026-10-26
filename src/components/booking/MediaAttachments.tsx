import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import type { RequestMedia } from '../../types';
import { C } from '../ui';

const MAX_PHOTOS = 4;
const MAX_VIDEOS = 1;
const MAX_AUDIO = 1;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

type Props = { media: RequestMedia[]; onChange: (media: RequestMedia[]) => void };
type MediaKind = 'image' | 'video' | 'audio';

const mediaName = (uri: string, fallback: string) => uri.split('/').pop()?.split('?')[0] || fallback;
const formatDuration = (ms?: number) => {
  const seconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const audioExtensions = new Set(['aac', 'aif', 'aiff', 'amr', 'caf', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'weba', 'webm']);

export default function MediaAttachments({ media, onChange }: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<MediaKind | null>(null);
  const handleRecorderStatus = useCallback((status: { mediaServicesDidReset?: boolean }) => {
    if (status.mediaServicesDidReset) setError('L’enregistrement a été interrompu par le système. Vérifiez ou relancez votre message audio.');
  }, []);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, handleRecorderStatus);
  const recordingState = useAudioRecorderState(recorder, 250);
  const audioItem = media.find((item) => item.type === 'audio');
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const mediaRef = useRef(media);
  const onChangeRef = useRef(onChange);
  const recordingRef = useRef(false);

  useEffect(() => {
    mediaRef.current = media;
    onChangeRef.current = onChange;
    recordingRef.current = recordingState.isRecording;
  }, [media, onChange, recordingState.isRecording]);

  useEffect(() => {
    player.replace(audioItem?.uri ?? null);
  }, [audioItem?.uri, player]);

  useEffect(() => () => {
    if (recordingRef.current) {
      void recorder.stop().then(() => {
        const uri = recorder.uri;
        if (!uri) return;
        const current = mediaRef.current.filter((item) => item.type !== 'audio');
        onChangeRef.current([...current, { id: `audio-${Date.now()}`, uri, type: 'audio', name: 'Message audio', durationMs: recorder.getStatus().durationMillis }]);
        void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      }).catch(() => {});
    }
  }, [recorder]);

  const showError = (message: string) => setError(message);
  const count = (kind: MediaKind) => media.filter((item) => item.type === kind).length;

  const pickImages = async () => {
    setError('');
    const remaining = MAX_PHOTOS - count('image');
    if (remaining <= 0) return;
    try {
      setBusy('image');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.82 });
      if (result.canceled) return;
      const additions: RequestMedia[] = result.assets
        .filter((asset) => !asset.mimeType || asset.mimeType.startsWith('image/'))
        .filter((asset) => !media.some((item) => item.uri === asset.uri))
        .slice(0, remaining)
        .map((asset, index) => ({ id: `image-${Date.now()}-${index}`, uri: asset.uri, type: 'image', name: asset.fileName || mediaName(asset.uri, 'Photo jointe'), fileSize: asset.fileSize ?? undefined }));
      if (additions.length) onChange([...media, ...additions]);
      else if (result.assets.length) showError('Aucune photo compatible n’a été sélectionnée.');
    } catch {
      showError('La sélection des photos est indisponible. Réessayez ou continuez sans pièce jointe.');
    } finally {
      setBusy(null);
    }
  };

  const pickVideo = async () => {
    setError('');
    if (count('video') >= MAX_VIDEOS) return;
    try {
      setBusy('video');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false, selectionLimit: 1, videoMaxDuration: 180 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || (asset.mimeType && !asset.mimeType.startsWith('video/'))) {
        showError('Ce format vidéo n’est pas pris en charge.');
        return;
      }
      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_VIDEO_BYTES) {
        showError('La vidéo dépasse la limite de 50 Mo. Choisissez un fichier plus léger.');
        return;
      }
      if (!media.some((item) => item.uri === asset.uri)) {
        onChange([...media.filter((item) => item.type !== 'video'), { id: `video-${Date.now()}`, uri: asset.uri, type: 'video', name: asset.fileName || mediaName(asset.uri, 'Vidéo jointe'), durationMs: asset.duration ?? undefined, fileSize: asset.fileSize ?? undefined }]);
      }
    } catch {
      showError('La sélection de la vidéo est indisponible. Vérifiez son format et réessayez.');
    } finally {
      setBusy(null);
    }
  };

  const startRecording = async () => {
    setError('');
    if (count('audio') >= MAX_AUDIO) return;
    try {
      setBusy('audio');
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showError('Accès au microphone refusé. Vous pouvez autoriser l’accès dans les réglages ou choisir un fichier audio.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      showError('L’enregistrement audio n’est pas disponible sur cet appareil ou dans ce navigateur.');
    } finally {
      setBusy(null);
    }
  };

  const stopRecording = async () => {
    try {
      setBusy('audio');
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) {
        showError('Aucun enregistrement n’a été créé. Réessayez.');
        return;
      }
      onChange([...media.filter((item) => item.type !== 'audio'), { id: `audio-${Date.now()}`, uri, type: 'audio', name: 'Message audio', durationMs: recordingState.durationMillis, fileSize: recordingState.fileSize }]);
    } catch {
      showError('L’enregistrement a été interrompu et n’a pas pu être conservé.');
    } finally {
      setBusy(null);
    }
  };

  const pickAudioFile = async () => {
    setError('');
    if (count('audio') >= MAX_AUDIO) return;
    try {
      setBusy('audio');
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: false, copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      const file = result.assets[0];
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!(file.mimeType?.startsWith('audio/') || audioExtensions.has(extension))) {
        showError('Choisissez un fichier audio compatible.');
        return;
      }
      if (typeof file.size === 'number' && file.size > MAX_AUDIO_BYTES) {
        showError('Le fichier audio dépasse la limite de 20 Mo.');
        return;
      }
      onChange([...media.filter((item) => item.type !== 'audio'), { id: `audio-${Date.now()}`, uri: file.uri, type: 'audio', name: file.name, fileSize: file.size }]);
    } catch {
      showError('La sélection de fichiers audio est indisponible sur cet appareil.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (id: string) => {
    const removed = media.find((item) => item.id === id);
    if (removed?.type === 'audio') {
      player.pause();
      player.replace(null);
    }
    onChange(media.filter((item) => item.id !== id));
  };

  const actions: { kind: MediaKind; title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; disabled: boolean }[] = [
    { kind: 'image', title: 'Photo', subtitle: `${count('image')}/${MAX_PHOTOS}`, icon: 'image-outline', onPress: pickImages, disabled: count('image') >= MAX_PHOTOS },
    { kind: 'video', title: 'Vidéo', subtitle: count('video') ? '1/1' : 'Max 100 Mo', icon: 'videocam-outline', onPress: pickVideo, disabled: count('video') >= MAX_VIDEOS },
    { kind: 'audio', title: 'Audio', subtitle: recordingState.isRecording ? 'En cours…' : audioItem ? '1/1 joint' : 'Enregistrer', icon: recordingState.isRecording ? 'stop-circle-outline' : 'mic-outline', onPress: recordingState.isRecording ? stopRecording : startRecording, disabled: !!audioItem || (!!busy && busy !== 'audio') },
  ];

  return <View>
    <Text style={{ color: C.navy, fontSize: 16, fontWeight: '800', marginBottom: 10 }}>Photos, vidéos et audio</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {actions.map((action) => <Pressable key={action.kind} accessibilityRole="button" accessibilityLabel={`${action.title}, ${action.subtitle}`} disabled={action.disabled || !!busy} onPress={action.onPress} style={({ pressed }) => ({ flex: 1, minHeight: 76, borderRadius: 15, borderWidth: 1, borderColor: action.kind === 'audio' && recordingState.isRecording ? C.red : C.line, backgroundColor: action.kind === 'audio' && recordingState.isRecording ? '#FFF2F3' : C.white, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, opacity: action.disabled ? 0.48 : pressed ? 0.84 : 1 })}>
        {busy === action.kind ? <ActivityIndicator size="small" color={C.blue} /> : <Ionicons name={action.icon} size={21} color={action.kind === 'audio' && recordingState.isRecording ? C.red : C.blue} />}
        <Text numberOfLines={1} style={{ color: C.navy, fontSize: 12, fontWeight: '800', marginTop: 5 }}>{action.title}</Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{action.subtitle}</Text>
      </Pressable>)}
    </View>

    {audioItem && <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAF5FB', borderRadius: 14, padding: 10, marginTop: 9 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="musical-notes-outline" size={18} color={C.blue} /></View>
      <View style={{ flex: 1, marginLeft: 9 }}><Text numberOfLines={1} style={{ color: C.navy, fontSize: 12, fontWeight: '700' }}>{audioItem.name}</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{audioItem.durationMs ? formatDuration(audioItem.durationMs) : 'Fichier audio joint'}{audioItem.fileSize ? ` · ${(audioItem.fileSize / 1024 / 1024).toFixed(1)} Mo` : ''}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={playerStatus.playing ? 'Mettre en pause le message audio' : 'Écouter le message audio'} onPress={() => { if (playerStatus.playing) player.pause(); else { player.seekTo(0); player.play(); } }} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={playerStatus.playing ? 'pause-circle' : 'play-circle'} size={27} color={C.blue} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Supprimer le message audio" onPress={() => remove(audioItem.id)} style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={18} color={C.muted} /></Pressable>
    </View>}

    {!!media.filter((item) => item.type !== 'audio').length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {media.filter((item) => item.type !== 'audio').map((item) => item.type === 'image' ? <View key={item.id} style={{ width: 76, alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 13, overflow: 'hidden', backgroundColor: '#E8F1F7', borderWidth: 1, borderColor: C.line }}>
          <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <Pressable accessibilityRole="button" accessibilityLabel={`Retirer la photo ${item.name}`} onPress={() => remove(item.id)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFFEE', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={15} color={C.navy} /></Pressable>
        </View>
        <Text numberOfLines={1} style={{ width: 74, color: C.muted, fontSize: 9, marginTop: 3, textAlign: 'center' }}>{item.name}</Text>
      </View> : <View key={item.id} style={{ width: 190, height: 72, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 13, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
        <View style={{ width: 50, height: 54, borderRadius: 10, backgroundColor: '#EAF5FB', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="videocam" size={21} color={C.blue} /><Ionicons name="play" size={11} color={C.navy} style={{ position: 'absolute', bottom: 6, right: 6 }} /></View>
        <View style={{ flex: 1, marginHorizontal: 8 }}><Text numberOfLines={2} style={{ color: C.navy, fontSize: 10, lineHeight: 13, fontWeight: '700' }}>{item.name}</Text><Text style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>{item.durationMs ? formatDuration(item.durationMs) : 'Vidéo jointe'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retirer la vidéo ${item.name}`} onPress={() => remove(item.id)} style={{ width: 25, height: 32, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close-circle" size={19} color={C.muted} /></Pressable>
      </View>)}
    </View>}

    {!audioItem && !recordingState.isRecording && <Pressable accessibilityRole="button" accessibilityLabel="Choisir un fichier audio existant" onPress={pickAudioFile} disabled={!!busy} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: busy ? 0.5 : 1 }}><Ionicons name="folder-open-outline" size={15} color={C.blue} /><Text style={{ color: C.blue, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Choisir un fichier audio</Text></Pressable>}
    {recordingState.isRecording && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 7 }} /><Text style={{ color: C.red, fontSize: 12, fontWeight: '800' }}>Enregistrement · {formatDuration(recordingState.durationMillis)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Arrêter et enregistrer le message audio" onPress={stopRecording} style={{ marginLeft: 'auto', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: C.red }}><Text style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>Arrêter</Text></Pressable></View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 12, lineHeight: 17, marginTop: 7 }}>{error}</Text>}
    <Text style={{ color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 4 }}>{count('image')}/{MAX_PHOTOS} photos · {count('video')}/{MAX_VIDEOS} vidéo · {count('audio')}/{MAX_AUDIO} audio</Text>
  </View>;
}
