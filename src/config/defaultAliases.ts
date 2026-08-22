import { EventAliasMap } from '../types';

/**
 * Single Source of Truth for Official AIROX'26 Symposium Events.
 * Unified canonicalization pipeline for Technical & Non-Technical events.
 */
export const DEFAULT_EVENT_REGISTRY: EventAliasMap = {
  // ==========================================
  // OFFICIAL TECHNICAL EVENTS (AIROX'26)
  // ==========================================
  'the final hire': {
    displayName: 'The Final Hire',
    category: 'Technical',
    aliases: [
      'the final hire',
      'the finalhire',
      'the final  hire',
      'the final   hire',
      'thefinalhire',
      'final hire',
      'finalhire',
      'the final hire (mock interview)',
      'the final-hire',
      'final-hire',
      'mock interview'
    ]
  },
  'zero hour': {
    displayName: 'Zero Hour',
    category: 'Technical',
    aliases: [
      'zero hour',
      'zerohour',
      'zero  hour',
      'zero   hour',
      'zero-hour',
      '0 hour',
      '0-hour',
      'zero hours',
      'zero  hours'
    ]
  },
  'paper presentation': {
    displayName: 'Paper Presentation',
    category: 'Technical',
    aliases: [
      'paper presentation',
      'ppt',
      'paper-presentation',
      'paper presenation',
      'presentation',
      'technical ppt',
      'paper  presentation',
      'paperpresentation',
      'tech ppt',
      'paper presentation (ppt)'
    ]
  },
  'the prompt league': {
    displayName: 'The Prompt League',
    category: 'Technical',
    aliases: [
      'the prompt league',
      'thepromptleague',
      'prompt league',
      'promptleague',
      'prompt-league',
      'the prompt-league',
      'the prompt  league',
      'prompt craft',
      'promptcraft',
      'prompt-craft',
      'ai prompt craft',
      'prompt engineering',
      'prompt challenge'
    ]
  },

  // ==========================================
  // OFFICIAL NON-TECHNICAL EVENTS (AIROX'26)
  // ==========================================
  'ads shot': {
    displayName: 'ADS SHOT',
    category: 'Non-Technical',
    aliases: [
      'ads shot',
      'ad shot',
      'ads-shot',
      'ad-shot',
      'adshot',
      'adsshot',
      'ads  shot',
      'ad  shot',
      'ads   shot',
      'ad   shot',
      'ad battle',       // Explicit known legacy / data-entry mistake for AIROX'26
      'adbattle',
      'ad-battle',
      'ad  battle',
      'ad zap',
      'adzap',
      'ad-zap',
      'advertisement zap',
      'ad shoot',
      'ads shoot',
      'ad photography'
    ]
  },
  'goated or ghosted': {
    displayName: 'GOATED OR GHOSTED',
    category: 'Non-Technical',
    aliases: [
      'goated or ghosted',
      'goated / ghosted',
      'goated /ghosted',
      'goated/ghosted',
      'goated or  ghosted',
      'goated  or  ghosted',
      'goated n ghosted',
      'goated & ghosted',
      'goatedorghosted',
      'goated',
      'ghosted',
      'goated-or-ghosted'
    ]
  },
  'clash and conquer': {
    displayName: 'CLASH AND CONQUER',
    category: 'Non-Technical',
    aliases: [
      'clash and conquer',
      'clash & conquer',
      'clash n conquer',
      'clashandconquer',
      'clash & concquer',
      'clash  and  conquer',
      'clash   and   conquer',
      'clash-and-conquer',
      'clash conquer',
      'clash'
    ]
  },
  'box cricket': {
    displayName: 'BOX CRICKET',
    category: 'Non-Technical',
    aliases: [
      'box cricket',
      'boxcricket',
      'box-cricket',
      'box  cricket',
      'box   cricket',
      'cricket',
      'box match',
      'gully cricket',
      'ipl auction',
      'ipl-auction',
      'iplauction'
    ]
  },
  'esports (free fire & stumble guys)': {
    displayName: 'ESPORTS (FREE FIRE & STUMBLE GUYS)',
    category: 'Non-Technical',
    aliases: [
      'esports (free fire & stumble guys)',
      'esports (free fire and stumble guys)',
      'esports',
      'esports gaming',
      'free fire & stumble guys',
      'free fire and stumble guys',
      'free fire & stumbleguys',
      'free fire',
      'freefire',
      'stumble guys',
      'stumbleguys',
      'gaming - free fire',
      'gaming - bgmi',
      'gaming',
      'bgmi',
      'bgmi gaming',
      'esports bgmi',
      'ff',
      'ff & stumble guys',
      'battlegrounds mobile'
    ]
  }
};

