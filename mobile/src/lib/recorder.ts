// En la app nativa la grabación de voz llegará con expo-audio. Por ahora solo web.
export type VoiceResult = { uri: string; mime: string; duration: number; waveform: number[] };

export function useVoiceRecorder() {
  return {
    supported: false,
    state: 'idle' as 'idle' | 'recording' | 'done',
    seconds: 0,
    levels: [] as number[],
    result: undefined as VoiceResult | undefined,
    error: '',
    start: async () => {},
    stop: () => {},
    reset: () => {},
  };
}
