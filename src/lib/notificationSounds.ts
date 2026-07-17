export type NotificationSound = 'ticket' | 'whatsapp_general' | 'whatsapp_assigned';

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ||= new AudioContextCtor();
  return audioContext;
}

export async function unlockNotificationSounds(): Promise<boolean> {
  const ctx = context();
  if (!ctx) return false;
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  return ctx.state === 'running';
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain: number) {
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.018);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Três assinaturas sonoras curtas, geradas localmente e sem carregamento de rede. */
export async function playNotificationSound(type: NotificationSound, volume = 0.7): Promise<boolean> {
  const ctx = context();
  if (!ctx || ctx.state !== 'running') return false;
  const gain = Math.max(0, Math.min(1, volume)) * 0.13;
  const now = ctx.currentTime + 0.015;
  if (type === 'ticket') {
    tone(ctx, 523.25, now, 0.18, gain);
    tone(ctx, 659.25, now + 0.13, 0.24, gain);
  } else if (type === 'whatsapp_general') {
    tone(ctx, 783.99, now, 0.12, gain);
    tone(ctx, 783.99, now + 0.17, 0.12, gain);
  } else {
    tone(ctx, 440, now, 0.13, gain);
    tone(ctx, 659.25, now + 0.11, 0.16, gain);
    tone(ctx, 880, now + 0.24, 0.22, gain);
  }
  return true;
}
