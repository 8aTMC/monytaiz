import { ShouldAutoRespondInput, ShouldAutoRespondResult } from './types';

export function shouldAutoRespond(input: ShouldAutoRespondInput): ShouldAutoRespondResult {
  if (!input.isCreator) return { ok: false, reason: 'not-creator' };
  
  // Check global AI settings first (master switch)
  if (!input.globalSettings?.enabled) return { ok: false, reason: 'global-ai-disabled' };
  
  // Check if global timer has expired
  if (input.globalSettings?.endTime) {
    const now = new Date();
    const endTime = new Date(input.globalSettings.endTime);
    if (now >= endTime) return { ok: false, reason: 'global-timer-expired' };
  }
  
  if (input.fanBlocked) return { ok: false, reason: 'fan-blocked' };
  if (input.isMuted) return { ok: false, reason: 'muted' };
  if (!input.aiCfg) return { ok: false, reason: 'no-config' };
  if (!input.aiCfg.aiEnabled) return { ok: false, reason: 'ai-disabled' };
  if (!input.aiCfg.autoResponseEnabled) return { ok: false, reason: 'auto-disabled' };
  if (input.convOverride?.disabled) return { ok: false, reason: 'conv-disabled' };
  return { ok: true };
}