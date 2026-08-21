import { EventAliasMap } from '../types';
import { DEFAULT_EVENT_REGISTRY } from '../config/defaultAliases';

/**
 * Standard string cleaning:
 * 1. Convert to lowercase
 * 2. Trim whitespace
 * 3. Collapse multiple spaces
 * 4. Normalize common punctuation & symbols
 */
export function cleanRawString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[“”"']/g, '') // remove quotes
    .replace(/&/g, ' and ') // normalize ampersands
    .replace(/[_\-]+/g, ' ') // convert dashes and underscores to spaces
    .replace(/[^\w\s/]/g, ' ') // strip non-alphanumeric except slashes & spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * De-camelcase/unconcatenate words before processing
 * e.g. "FinalHire" -> "Final Hire", "TheFinalHire" -> "The Final Hire"
 */
export function splitJoinedWords(str: string): string {
  if (!str) return '';
  // Insert space before capital letters if preceded by lowercase
  let result = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Insert space between letters and numbers
  result = result.replace(/([a-zA-Z])([0-9])/g, '$1 $2');
  result = result.replace(/([0-9])([a-zA-Z])/g, '$1 $2');
  return result;
}

/**
 * Strip all spaces and non-alphanumeric chars for ultra-strict token equivalence
 * e.g. "the final hire" -> "thefinalhire", "the finalhire" -> "thefinalhire"
 */
export function getStrippedKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Convert string to clean Title Case for UI display
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  const minorWords = new Set(['and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'a', 'an']);
  const acronyms = new Set(['ipl', 'bgmi', 'ppt', 'ai', 'vr', 'ar', 'ui', 'ux', 'iot', 'it']);

  return str
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) {
        return lower.toUpperCase();
      }
      if (index > 0 && minorWords.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Levenshtein distance for conservative fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Calculate similarity between 0 and 1
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return (maxLength - distance) / maxLength;
}

/**
 * Main Event Normalization Pipeline:
 *
 * Given a raw event name (e.g. "The FinalHire", "AD SHOT", "AD BATTLE", "Goated  Or  Ghosted"),
 * resolves to the canonical key, display name, category, and matching diagnostic.
 */
export class EventNormalizer {
  private registry: EventAliasMap;
  private strippedKeyToCanonical: Map<string, string>;
  private aliasToCanonical: Map<string, string>;

  constructor(customRegistry?: EventAliasMap) {
    this.registry = { ...DEFAULT_EVENT_REGISTRY, ...(customRegistry || {}) };
    this.strippedKeyToCanonical = new Map();
    this.aliasToCanonical = new Map();
    this.rebuildIndex();
  }

  public updateRegistry(newRegistry: EventAliasMap) {
    this.registry = { ...newRegistry };
    this.rebuildIndex();
  }

  public getRegistry(): EventAliasMap {
    return this.registry;
  }

  /**
   * Returns list of canonical events with displayName, category, and canonical key
   */
  public getCanonicalEventsList(): { key: string; displayName: string; category: 'Technical' | 'Non-Technical' | 'Both' }[] {
    return Object.entries(this.registry).map(([key, item]) => ({
      key,
      displayName: item.displayName,
      category: item.category || 'Technical'
    }));
  }

  private rebuildIndex() {
    this.strippedKeyToCanonical.clear();
    this.aliasToCanonical.clear();

    for (const [canonicalKey, config] of Object.entries(this.registry)) {
      const cleanCanonical = cleanRawString(canonicalKey);
      const strippedCanonical = getStrippedKey(canonicalKey);

      this.strippedKeyToCanonical.set(strippedCanonical, canonicalKey);
      this.aliasToCanonical.set(cleanCanonical, canonicalKey);

      // Register all explicit aliases
      for (const alias of config.aliases) {
        const cleanAlias = cleanRawString(alias);
        const strippedAlias = getStrippedKey(alias);

        this.aliasToCanonical.set(cleanAlias, canonicalKey);
        this.strippedKeyToCanonical.set(strippedAlias, canonicalKey);
      }
    }
  }

  /**
   * Normalize an event string to its canonical key, display name, and category
   */
  public normalize(
    rawInput: string,
    hintCategory?: 'Technical' | 'Non-Technical'
  ): {
    canonicalKey: string;
    displayName: string;
    category: 'Technical' | 'Non-Technical' | 'Both';
    matchedBy: string;
    aliasNote?: string;
  } {
    if (!rawInput || !rawInput.trim()) {
      return {
        canonicalKey: '',
        displayName: '',
        category: hintCategory || 'Technical',
        matchedBy: 'empty'
      };
    }

    const trimmed = rawInput.trim();
    // Step 1: Pre-process string (split joined camelCase if any)
    const splitInput = splitJoinedWords(trimmed);
    const cleaned = cleanRawString(splitInput);
    const stripped = getStrippedKey(trimmed);

    // Detect if this is a known legacy / data-entry mistake (e.g., AD BATTLE)
    const isAdBattleLegacy = cleaned.includes('ad battle') || stripped === 'adbattle';
    const legacyNote = isAdBattleLegacy ? 'Known legacy/incorrect event name' : undefined;

    // Step 2: Direct alias / exact match check
    if (this.aliasToCanonical.has(cleaned)) {
      const canonicalKey = this.aliasToCanonical.get(cleaned)!;
      const config = this.registry[canonicalKey];
      return {
        canonicalKey,
        displayName: config?.displayName || toTitleCase(canonicalKey),
        category: config?.category || hintCategory || 'Technical',
        matchedBy: isAdBattleLegacy ? 'legacy_alias_map' : 'exact_alias',
        aliasNote: legacyNote
      };
    }

    // Step 3: Stripped match check (handles "The FinalHire" vs "The Final Hire", "AD  SHOT" vs "AD SHOT", "Goated  Or  Ghosted")
    if (this.strippedKeyToCanonical.has(stripped)) {
      const canonicalKey = this.strippedKeyToCanonical.get(stripped)!;
      const config = this.registry[canonicalKey];
      return {
        canonicalKey,
        displayName: config?.displayName || toTitleCase(canonicalKey),
        category: config?.category || hintCategory || 'Technical',
        matchedBy: isAdBattleLegacy ? 'legacy_alias_map' : 'stripped_spacing_match',
        aliasNote: legacyNote
      };
    }

    // Step 4: Check if any canonical key or alias shares the exact stripped form
    for (const [canonicalKey, config] of Object.entries(this.registry)) {
      if (getStrippedKey(canonicalKey) === stripped) {
        return {
          canonicalKey,
          displayName: config.displayName || toTitleCase(canonicalKey),
          category: config.category || hintCategory || 'Technical',
          matchedBy: 'stripped_canonical_match',
          aliasNote: legacyNote
        };
      }
      for (const alias of config.aliases) {
        if (getStrippedKey(alias) === stripped) {
          return {
            canonicalKey,
            displayName: config.displayName || toTitleCase(canonicalKey),
            category: config.category || hintCategory || 'Technical',
            matchedBy: 'stripped_alias_match',
            aliasNote: legacyNote
          };
        }
      }
    }

    // Step 5: Conservative Fuzzy Match (threshold 0.88+) with Safety check
    // CRITICAL: Prevent "The Final Hire" and "The Final Fight" from merging!
    let bestMatchKey: string | null = null;
    let highestSim = 0;

    for (const [canonicalKey, config] of Object.entries(this.registry)) {
      const sim = stringSimilarity(cleaned, cleanRawString(canonicalKey));
      if (sim > highestSim && sim >= 0.88) {
        // Double check token safety: if the last or distinguishing noun differs significantly, reject
        const tokensA = cleaned.split(' ');
        const tokensB = cleanRawString(canonicalKey).split(' ');
        if (tokensA.length === tokensB.length) {
          let tokenMismatch = false;
          for (let i = 0; i < tokensA.length; i++) {
            if (stringSimilarity(tokensA[i], tokensB[i]) < 0.6) {
              tokenMismatch = true;
              break;
            }
          }
          if (tokenMismatch) continue;
        }

        highestSim = sim;
        bestMatchKey = canonicalKey;
      }
    }

    if (bestMatchKey) {
      const config = this.registry[bestMatchKey];
      return {
        canonicalKey: bestMatchKey,
        displayName: config?.displayName || toTitleCase(bestMatchKey),
        category: config?.category || hintCategory || 'Technical',
        matchedBy: `conservative_fuzzy_${Math.round(highestSim * 100)}%`,
        aliasNote: legacyNote
      };
    }

    // Step 6: Dynamic new event (not in predefined registry) - canonicalize cleanly
    const dynamicCanonical = cleaned;
    const dynamicDisplayName = toTitleCase(trimmed);
    const dynamicCategory = hintCategory || 'Technical';

    // Register this new event dynamically so multiple occurrences in the file map consistently
    this.registry[dynamicCanonical] = {
      displayName: dynamicDisplayName,
      category: dynamicCategory,
      aliases: [cleaned, trimmed]
    };
    this.strippedKeyToCanonical.set(stripped, dynamicCanonical);
    this.aliasToCanonical.set(cleaned, dynamicCanonical);

    return {
      canonicalKey: dynamicCanonical,
      displayName: dynamicDisplayName,
      category: dynamicCategory,
      matchedBy: 'dynamic_new_event'
    };
  }

  /**
   * Split a comma/semicolon/pipe/newline separated cell into individual event strings
   */
  public parseEventCell(cellValue: any): string[] {
    if (!cellValue) return [];
    const str = String(cellValue).trim();
    if (!str || str.toLowerCase() === 'nil' || str.toLowerCase() === 'none' || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a' || str === '-') {
      return [];
    }

    // Split on commas, semicolons, pipe, newlines
    const rawTokens = str
      .split(/[,;\n\r|]/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.toLowerCase() !== 'nil' && t.toLowerCase() !== 'none' && t.toLowerCase() !== 'na');

    return rawTokens;
  }
}

export const defaultNormalizer = new EventNormalizer();
