import { Rule } from 'app/types/unified-alerting';
import {
  PromRuleDTO,
  PromRuleGroupDTO,
  RulerCloudRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { getPromRuleFingerprint, getRulerRuleFingerprint } from '../utils/rule-id';
import { getRuleName } from '../utils/rules';

// Efficient array comparison without string concatenation
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function getMatchingRulerRule(rulerRuleGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>, rule: Rule) {
  // Pre-calculate fingerprints for the prometheus rule to avoid redundant calculations
  const promRuleFingerprintNoQuery = getPromRuleFingerprint(rule, false);
  const promRuleFingerprintWithQuery = getPromRuleFingerprint(rule, true);
  
  const rulesByName = rulerRuleGroup.rules.filter((r) => getRuleName(r) === rule.name);
  
  // If all rule names are unique, we can use the rule name to find the rule
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // Single iteration approach: try different matching strategies
  const labelsAndAnnotationsMatches: RulerCloudRuleDTO[] = [];
  const fullMatches: RulerCloudRuleDTO[] = [];

  for (const rulerRule of rulesByName) {
    const rulerFingerprintNoQuery = getRulerRuleFingerprint(rulerRule, false);
    
    // Check labels and annotations match
    if (arraysEqual(rulerFingerprintNoQuery, promRuleFingerprintNoQuery)) {
      labelsAndAnnotationsMatches.push(rulerRule);
      
      // If this also matches with query, add to full matches
      const rulerFingerprintWithQuery = getRulerRuleFingerprint(rulerRule, true);
      if (arraysEqual(rulerFingerprintWithQuery, promRuleFingerprintWithQuery)) {
        fullMatches.push(rulerRule);
      }
    }
  }

  // Return unique match if found
  if (labelsAndAnnotationsMatches.length === 1) {
    return labelsAndAnnotationsMatches[0];
  }

  if (fullMatches.length === 1) {
    return fullMatches[0];
  }

  return undefined;
}

export function getMatchingPromRule(promRuleGroup: PromRuleGroupDTO<PromRuleDTO>, rule: RulerCloudRuleDTO) {
  // Pre-calculate fingerprints for the ruler rule to avoid redundant calculations
  const rulerRuleFingerprintNoQuery = getRulerRuleFingerprint(rule, false);
  const rulerRuleFingerprintWithQuery = getRulerRuleFingerprint(rule, true);
  
  const rulesByName = promRuleGroup.rules.filter((r) => r.name === getRuleName(rule));
  
  // If all rule names are unique, we can use the rule name to find the rule
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // Single iteration approach: try different matching strategies
  const labelsAndAnnotationsMatches: PromRuleDTO[] = [];
  const fullMatches: PromRuleDTO[] = [];

  for (const promRule of rulesByName) {
    const promFingerprintNoQuery = getPromRuleFingerprint(promRule, false);
    
    // Check labels and annotations match
    if (arraysEqual(promFingerprintNoQuery, rulerRuleFingerprintNoQuery)) {
      labelsAndAnnotationsMatches.push(promRule);
      
      // If this also matches with query, add to full matches
      const promFingerprintWithQuery = getPromRuleFingerprint(promRule, true);
      if (arraysEqual(promFingerprintWithQuery, rulerRuleFingerprintWithQuery)) {
        fullMatches.push(promRule);
      }
    }
  }

  // Return unique match if found
  if (labelsAndAnnotationsMatches.length === 1) {
    return labelsAndAnnotationsMatches[0];
  }

  if (fullMatches.length === 1) {
    return fullMatches[0];
  }

  return undefined;
}

interface GroupMatchingResult {
  matches: Map<RulerRuleDTO, PromRuleDTO>;
  promOnlyRules: PromRuleDTO[];
}

export function matchRulesGroup(
  rulerGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>,
  promGroup: PromRuleGroupDTO<PromRuleDTO>
): GroupMatchingResult {
  // Build optimized indexes for prometheus rules to avoid O(n²) complexity
  const promRulesByName = new Map<string, PromRuleDTO[]>();
  const promRulesByFingerprintNoQuery = new Map<string, PromRuleDTO[]>();
  const promRulesByFingerprintWithQuery = new Map<string, PromRuleDTO[]>();

  // Pre-calculate all prometheus rule fingerprints and build indexes
  for (const promRule of promGroup.rules) {
    const name = promRule.name;
    const fingerprintNoQuery = getPromRuleFingerprint(promRule, false);
    const fingerprintWithQuery = getPromRuleFingerprint(promRule, true);
    
    // Index by name
    if (!promRulesByName.has(name)) {
      promRulesByName.set(name, []);
    }
    promRulesByName.get(name)!.push(promRule);
    
    // Index by fingerprint (without query)
    const fingerprintNoQueryKey = fingerprintNoQuery.join('|');
    if (!promRulesByFingerprintNoQuery.has(fingerprintNoQueryKey)) {
      promRulesByFingerprintNoQuery.set(fingerprintNoQueryKey, []);
    }
    promRulesByFingerprintNoQuery.get(fingerprintNoQueryKey)!.push(promRule);
    
    // Index by fingerprint (with query)
    const fingerprintWithQueryKey = fingerprintWithQuery.join('|');
    if (!promRulesByFingerprintWithQuery.has(fingerprintWithQueryKey)) {
      promRulesByFingerprintWithQuery.set(fingerprintWithQueryKey, []);
    }
    promRulesByFingerprintWithQuery.get(fingerprintWithQueryKey)!.push(promRule);
  }

  const matches = new Map<RulerRuleDTO, PromRuleDTO>();
  const matchedPromRules = new Set<PromRuleDTO>();

  // Process ruler rules using indexed lookups - O(n) instead of O(n²)
  for (const rulerRule of rulerGroup.rules) {
    const ruleName = getRuleName(rulerRule);
    const candidatesByName = promRulesByName.get(ruleName) || [];

    if (candidatesByName.length === 0) {
      continue; // No prometheus rules with this name
    }

    let matchedPromRule: PromRuleDTO | undefined;

    if (candidatesByName.length === 1) {
      // Unique by name - fast path
      matchedPromRule = candidatesByName[0];
    } else {
      // Multiple candidates - use fingerprint matching
      const rulerFingerprintNoQuery = getRulerRuleFingerprint(rulerRule, false);
      const rulerFingerprintWithQuery = getRulerRuleFingerprint(rulerRule, true);
      
      // Try labels/annotations match first
      const fingerprintNoQueryKey = rulerFingerprintNoQuery.join('|');
      const labelsMatches = promRulesByFingerprintNoQuery.get(fingerprintNoQueryKey) || [];
      const nameAndLabelsMatches = labelsMatches.filter(rule => rule.name === ruleName);
      
      if (nameAndLabelsMatches.length === 1) {
        matchedPromRule = nameAndLabelsMatches[0];
      } else {
        // Try full match including query
        const fingerprintWithQueryKey = rulerFingerprintWithQuery.join('|');
        const fullMatches = promRulesByFingerprintWithQuery.get(fingerprintWithQueryKey) || [];
        const nameAndFullMatches = fullMatches.filter(rule => rule.name === ruleName);
        
        if (nameAndFullMatches.length === 1) {
          matchedPromRule = nameAndFullMatches[0];
        }
      }
    }

    if (matchedPromRule && !matchedPromRules.has(matchedPromRule)) {
      matches.set(rulerRule, matchedPromRule);
      matchedPromRules.add(matchedPromRule);
    }
  }

  // Calculate unmatched prometheus rules
  const promOnlyRules = promGroup.rules.filter(rule => !matchedPromRules.has(rule));

  return { matches, promOnlyRules };
}

// ==============================================================================
// ORIGINAL IMPLEMENTATIONS (for benchmarking comparison)
// ==============================================================================

export function getMatchingRulerRuleOriginal(rulerRuleGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>, rule: Rule) {
  // If all rule names are unique, we can use the rule name to find the rule. We don't need to hash the rule
  const rulesByName = rulerRuleGroup.rules.filter((r) => getRuleName(r) === rule.name);
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // If we don't have a unique rule name, try to compare by labels and annotations
  const rulesByLabelsAndAnnotations = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, false).join('-') === getPromRuleFingerprint(rule, false).join('-');
  });

  if (rulesByLabelsAndAnnotations.length === 1) {
    return rulesByLabelsAndAnnotations[0];
  }

  // As a last resort, compare including the query
  const rulesByLabelsAndAnnotationsAndQuery = rulesByName.filter((r) => {
    return getRulerRuleFingerprint(r, true).join('-') === getPromRuleFingerprint(rule, true).join('-');
  });

  if (rulesByLabelsAndAnnotationsAndQuery.length === 1) {
    return rulesByLabelsAndAnnotationsAndQuery[0];
  }

  return undefined;
}

export function getMatchingPromRuleOriginal(promRuleGroup: PromRuleGroupDTO<PromRuleDTO>, rule: RulerCloudRuleDTO) {
  // If all rule names are unique, we can use the rule name to find the rule. We don't need to hash the rule
  const rulesByName = promRuleGroup.rules.filter((r) => r.name === getRuleName(rule));
  if (rulesByName.length === 1) {
    return rulesByName[0];
  }

  // If we don't have a unique rule name, try to compare by labels and annotations
  const rulesByLabelsAndAnnotations = rulesByName.filter((r) => {
    return getPromRuleFingerprint(r, false).join('-') === getRulerRuleFingerprint(rule, false).join('-');
  });

  if (rulesByLabelsAndAnnotations.length === 1) {
    return rulesByLabelsAndAnnotations[0];
  }

  // As a last resort, compare including the query
  const rulesByLabelsAndAnnotationsAndQuery = rulesByName.filter((r) => {
    return getPromRuleFingerprint(r, true).join('-') === getRulerRuleFingerprint(rule, true).join('-');
  });

  if (rulesByLabelsAndAnnotationsAndQuery.length === 1) {
    return rulesByLabelsAndAnnotationsAndQuery[0];
  }

  return undefined;
}

export function matchRulesGroupOriginal(
  rulerGroup: RulerRuleGroupDTO<RulerCloudRuleDTO>,
  promGroup: PromRuleGroupDTO<PromRuleDTO>
): GroupMatchingResult {
  const matchingResult = rulerGroup.rules.reduce(
    (acc, rulerRule) => {
      const { matches, unmatchedPromRules } = acc;

      const promRule = getMatchingPromRuleOriginal(promGroup, rulerRule);
      if (promRule) {
        matches.set(rulerRule, promRule);
        unmatchedPromRules.delete(promRule);
      }
      return acc;
    },
    { matches: new Map<RulerRuleDTO, PromRuleDTO>(), unmatchedPromRules: new Set(promGroup.rules) }
  );

  return { matches: matchingResult.matches, promOnlyRules: Array.from(matchingResult.unmatchedPromRules) };
}
