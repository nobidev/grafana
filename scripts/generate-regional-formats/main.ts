#!/usr/bin/env node

/**
 * Generate Regional Formats/Locales for Grafana
 *
 * This script fetches locale data from the CLDR (Common Locale Data Repository)
 * and filters it to find valid regional format options for users.
 *
 * Criteria for valid options:
 * 1. Must be a variant of a Grafana supported language
 * 2. Must have CLDR coverage level defined as 'modern'
 * 3. Must pass Intl API validation checks
 * and other checks designed to keep out superfluous locales
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

import { fetchCLDRCoverageLevels, fetchCLDRParentLocales, fetchCLDRTerritoryInfo } from './lib/github.ts';
import { GRAFANA_LANGUAGES } from './lib/grafana-languages.ts';
import { logLocaleTable } from './lib/logLocaleTable.ts';
import { writeOutputFile } from './writeOutputFile.ts';

inspect.defaultOptions.maxArrayLength = null;

// Remove overly generic locales
const LOCALE_DENY_LIST = [
  'en', // English
  'en-001', // English (World)
  'en-150', // English (Europe)
  'es-419', // Latin American Spanish
  'zh', // Chinese, in favor of zh-Hans and zh-Hant
];

/**
 * Fetch the list of locales that browsers should have full support for, according to
 * the CLDR coverage levels
 * See https://cldr.unicode.org/index/cldr-spec/coverage-levels
 */
const coverageLevels = await fetchCLDRCoverageLevels();

/**
 * Fetch territory information to determine official languages for each territory
 */
const territoryInfo = await fetchCLDRTerritoryInfo();
const browserSupportedLocales = Object.entries(coverageLevels.effectiveCoverageLevels)
  .filter(([, coverage]) => coverage === 'modern')
  .map(([locale]) => locale);
console.log(`Found ${browserSupportedLocales.length} locales with full browser support.`);

/**
 * Create a list of language tags Grafana supports. Converts en-US to en.
 * This list currently includes duplicates, which is fine for now.
 */
const grafanaLanguageTags = GRAFANA_LANGUAGES.map((v) => v.split('-')[0]);

const validLocales = browserSupportedLocales
  /**
   * Filter the list of browser supported locales to those that match Grafana's languages
   */
  .filter((locale) => {
    const language = locale.split('-')[0];
    return grafanaLanguageTags.includes(language);
  })

  /**
   * Hard-coded language exclusions
   */
  .filter((locale) => {
    return !LOCALE_DENY_LIST.includes(locale);
  })

  /**
   * Filter to only include languages that have official status in their territory
   * Official status includes: 'official', 'official_regional', 'de_facto_official'
   */
  .filter((locale) => {
    const parts = locale.split('-');
    const language = parts[0];
    const territory = parts.at(1);
    if (!territory?.match(/^[A-Z]{2}$/)) {
      return true;
    }

    // Remove if territory doesn't exist in CLDR
    const territoryData = territoryInfo[territory];
    if (!territoryData?.languagePopulation) {
      console.log(`Removing ${locale} - no territory data found for ${territory}`);
      return false;
    }

    // Remove if territory doesn't have language
    const languageData = territoryData.languagePopulation[language];
    if (!languageData) {
      console.log(`Removing ${locale} - language ${language} not found in territory ${territory}`);
      return false;
    }

    // Remove if language doesn't have official status for territory
    const officialStatuses = ['official', 'official_regional', 'de_facto_official'];
    if (!languageData._officialStatus || !officialStatuses.includes(languageData._officialStatus)) {
      console.log(
        `Removing ${locale} - language ${language} in ${territory} has status: ${languageData._officialStatus || 'none'}`
      );
      return false;
    }

    // Remove if % of population that uses the language is less than threshold
    const popPercent = parseInt(languageData._populationPercent, 10);
    if (popPercent < 15) {
      console.log(`Removing ${locale} - language ${language} in ${territory} has population percent: ${popPercent}`);
      return false;
    }

    return true;
  })

  /**
   * Validate the locales with Intl checks. Note: This will pass for the Node LTS version
   * which we take as a strong signal for browser support.
   *
   * Requirements:
   * 1. Must successfully format a date with Intl.DateTimeFormat
   * 2. Must resolve to itself (not another locale)
   * 3. Must have a display name that's different from the locale code
   */
  .filter((locale) => {
    try {
      // Check 1: Must successfully format a date with Intl.DateTimeFormat
      const formatter = new Intl.DateTimeFormat(locale);
      const testDate = new Date(2024, 0, 1); // January 1, 2024
      formatter.format(testDate); // This will throw if locale is invalid

      // Check 2: Must resolve to itself (not another locale)
      const resolvedLocale = formatter.resolvedOptions().locale;
      if (resolvedLocale !== locale) {
        console.log(`Rejecting ${locale} because it resolved to ${resolvedLocale}`);
        return false;
      }

      // Check 3: Must have a language name that is not equal to the locale
      const displayNames = new Intl.DisplayNames([locale], { type: 'language' });
      const languageName = displayNames.of(locale);
      if (!languageName || languageName === locale) {
        console.log(`Rejecting ${locale} because language name is not valid: ${languageName}`);
        return false;
      }

      return true;
    } catch (error) {
      // If any Intl operation fails, reject this locale
      return false;
    }
  });

console.log(`\nAfter validation, ${validLocales.length} locales pass all checks`);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDir, 'output.ts');

logLocaleTable(validLocales);
await writeOutputFile(outputPath, validLocales);
console.log(`\nValid locales written to ${outputPath}`);
