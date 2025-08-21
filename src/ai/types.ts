export interface AIConfig {
  aiEnabled: boolean;
  autoResponseEnabled: boolean;
  defaultMode: string;
  safetyLevel: 'pg' | 'flirty' | 'spicy';
  model?: string;
  typingSimulationEnabled: boolean;
  updatedAt: string;
}

export interface ConversationOverride {
  disabled?: boolean;
  modeOverride?: string;
}

export interface CachedConfig<T> {
  data: T | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  lastFetched?: number;
  promise?: Promise<T>;
}

export interface MessageQueueItem {
  creatorId: string;
  conversationId: string;
  isCreator: boolean;
  fanId: string;
  text: string;
  timestamp: number;
}

export type AIResponseResult = 
  | { skipped: true; reason: string }
  | { skipped: false; reply: string };


export interface ShouldAutoRespondResult {
  ok: boolean;
  reason?: string;
}

export interface GlobalAISettings {
  enabled: boolean;
  mode: string;
  endTime: string | null;
  hoursRemaining: number;
  timerType: 'hours' | 'endTime';
  updatedAt: string;
}

export interface ShouldAutoRespondInput {
  isCreator: boolean;
  globalSettings?: GlobalAISettings;
  aiCfg?: { aiEnabled: boolean; autoResponseEnabled: boolean };
  convOverride?: { disabled?: boolean };
  isMuted?: boolean;
  fanBlocked?: boolean;
}