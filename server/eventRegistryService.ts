import fs from 'fs';
import path from 'path';

export interface EventConfigItem {
  displayName: string;
  category: 'Technical' | 'Non-Technical' | 'Both';
  aliases: string[];
}

export type EventAliasMap = Record<string, EventConfigItem>;

export const DEFAULT_SERVER_EVENT_REGISTRY: EventAliasMap = {
  // OFFICIAL TECHNICAL EVENTS
  'the final hire': {
    displayName: 'The Final Hire',
    category: 'Technical',
    aliases: [
      'the final hire',
      'the finalhire',
      'the final  hire',
      'thefinalhire',
      'final hire',
      'finalhire',
      'the final hire (mock interview)',
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
      'zero-hour',
      '0 hour',
      '0-hour',
      'zero hours'
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
      'prompt craft',
      'promptcraft',
      'ai prompt craft',
      'prompt engineering'
    ]
  },

  // OFFICIAL NON-TECHNICAL EVENTS
  'ads shot': {
    displayName: 'ADS SHOT',
    category: 'Non-Technical',
    aliases: [
      'ads shot',
      'adsshot',
      'ads-shot',
      'ad shot',
      'adshot',
      'ad battle',
      'adbattle',
      'ad-battle',
      'ad zap',
      'adzap',
      'ad shoot'
    ]
  },
  'goated or ghosted': {
    displayName: 'GOATED OR GHOSTED',
    category: 'Non-Technical',
    aliases: [
      'goated or ghosted',
      'goated / ghosted',
      'goated/ghosted',
      'goated n ghosted',
      'goated & ghosted',
      'goatedorghosted',
      'goated',
      'ghosted'
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
      'cricket',
      'box match',
      'gully cricket',
      'ipl auction',
      'ipl-auction'
    ]
  },
  'esports (free fire & stumble guys)': {
    displayName: 'ESPORTS (FREE FIRE & STUMBLE GUYS)',
    category: 'Non-Technical',
    aliases: [
      'esports (free fire & stumble guys)',
      'esports (free fire and stumble guys)',
      'esports',
      'free fire & stumble guys',
      'free fire and stumble guys',
      'free fire',
      'freefire',
      'stumble guys',
      'stumbleguys',
      'gaming - free fire',
      'gaming - bgmi',
      'gaming',
      'bgmi',
      'ff'
    ]
  }
};

class EventRegistryService {
  private registry: EventAliasMap;
  private filePath: string;
  private lastUpdated: string;

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'event_registry.json');
    this.registry = { ...DEFAULT_SERVER_EVENT_REGISTRY };
    this.lastUpdated = new Date().toISOString();
    this.loadFromDisk();
  }

  private ensureDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        // Ignore if directory already exists
      }
    }
  }

  private loadFromDisk() {
    try {
      this.ensureDir();
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          this.registry = parsed;
          this.lastUpdated = new Date().toISOString();
          return;
        }
      }
    } catch (err) {
      console.warn('[EventRegistryService] Error reading from disk, using defaults:', err);
    }
    this.saveToDisk();
  }

  private saveToDisk() {
    try {
      this.ensureDir();
      fs.writeFileSync(this.filePath, JSON.stringify(this.registry, null, 2), 'utf-8');
      this.lastUpdated = new Date().toISOString();
    } catch (err) {
      console.error('[EventRegistryService] Error saving to disk:', err);
    }
  }

  public getRegistry(): { registry: EventAliasMap; lastUpdated: string; totalEvents: number } {
    return {
      registry: { ...this.registry },
      lastUpdated: this.lastUpdated,
      totalEvents: Object.keys(this.registry).length
    };
  }

  public updateRegistry(newRegistry: EventAliasMap): { registry: EventAliasMap; lastUpdated: string; totalEvents: number } {
    if (!newRegistry || typeof newRegistry !== 'object' || Object.keys(newRegistry).length === 0) {
      throw new Error('Invalid event registry payload: At least one event is required.');
    }

    const cleanMap: EventAliasMap = {};
    for (const [key, item] of Object.entries(newRegistry)) {
      if (!item || !item.displayName) continue;
      const cleanKey = key.trim().toLowerCase() || item.displayName.trim().toLowerCase();
      const displayName = item.displayName.trim();
      const category = (item.category === 'Non-Technical' ? 'Non-Technical' : item.category === 'Both' ? 'Both' : 'Technical') as 'Technical' | 'Non-Technical' | 'Both';
      const aliases = Array.isArray(item.aliases)
        ? Array.from(new Set(item.aliases.map(a => String(a).trim().toLowerCase()).filter(Boolean)))
        : [cleanKey];

      if (!aliases.includes(cleanKey)) {
        aliases.unshift(cleanKey);
      }

      cleanMap[cleanKey] = {
        displayName,
        category,
        aliases
      };
    }

    if (Object.keys(cleanMap).length === 0) {
      throw new Error('No valid events found in submitted configuration.');
    }

    this.registry = cleanMap;
    this.saveToDisk();

    return {
      registry: { ...this.registry },
      lastUpdated: this.lastUpdated,
      totalEvents: Object.keys(this.registry).length
    };
  }

  public resetToDefault(): { registry: EventAliasMap; lastUpdated: string; totalEvents: number } {
    this.registry = { ...DEFAULT_SERVER_EVENT_REGISTRY };
    this.saveToDisk();
    return {
      registry: { ...this.registry },
      lastUpdated: this.lastUpdated,
      totalEvents: Object.keys(this.registry).length
    };
  }
}

export const serverEventRegistryService = new EventRegistryService();
