import { writeFile } from 'fs/promises';

const COMMENT_LANGUAGE = 'en-US';

function formatLine(locale: string) {
  const displayNames = new Intl.DisplayNames(COMMENT_LANGUAGE, { type: 'language' });

  const languageName = displayNames.of(locale) || locale;

  return `  '${locale}', // ${languageName}`;
}

export async function writeOutputFile(fileName: string, validLocales: string[]) {
  const tsFile = [
    // no prettier plz
    `export const REGION_FORMAT_CODES: string[] = [`,
    ...validLocales.map(formatLine),
    `];`,
    ``, // trailing newline
  ].join('\n');

  await writeFile(fileName, tsFile);
}
