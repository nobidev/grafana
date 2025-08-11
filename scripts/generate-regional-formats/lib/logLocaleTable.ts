import type { LocaleTableRow } from './types.ts';

/**
 * Logs a formatted table showing locale information including display names and date formatting examples
 *
 * @param validLocales Array of locale strings to display in the table
 */
export function logLocaleTable(validLocales: string[]): void {
  // Generate table of results with aligned columns
  const testDate = new Date(2024, 0, 15, 14, 30, 0); // January 15, 2024 at 2:30 PM

  // Collect all data first to determine column widths
  const tableData: LocaleTableRow[] = validLocales.map((locale): LocaleTableRow => {
    try {
      const formatter = new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const displayNames = new Intl.DisplayNames(undefined, { type: 'language' });

      const languageName = displayNames.of(locale) || locale;
      const formatted = formatter.format(testDate);

      return { locale, languageName, formatted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { locale, languageName: 'Error', formatted: errorMessage };
    }
  });

  // Calculate column widths
  const maxLocaleWidth = Math.max(6, ...tableData.map((row) => row.locale.length));
  const maxLanguageWidth = Math.max(13, ...tableData.map((row) => row.languageName.length));
  const maxFormatWidth = Math.max(18, ...tableData.map((row) => row.formatted.length));

  // Helper function to pad strings
  const padString = (str: string, width: number) => str.padEnd(width);

  // Print header
  console.log(
    `| ${padString('Locale', maxLocaleWidth)} | ${padString('Language Name', maxLanguageWidth)} | ${padString('Date & Time Format', maxFormatWidth)} |`
  );
  console.log(
    `|${'-'.repeat(maxLocaleWidth + 2)}|${'-'.repeat(maxLanguageWidth + 2)}|${'-'.repeat(maxFormatWidth + 2)}|`
  );

  // Print data rows
  tableData.forEach(({ locale, languageName, formatted }) => {
    console.log(
      `| ${padString(locale, maxLocaleWidth)} | ${padString(languageName, maxLanguageWidth)} | ${padString(formatted, maxFormatWidth)} |`
    );
  });
}
