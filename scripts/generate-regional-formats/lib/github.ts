import type { CoverageLevelsData, ParentLocalesData, TerritoryInfo } from './types.ts';

/**
 * Common function to fetch JSON data from the CLDR GitHub repository
 */
async function fetchCLDRData<T>(path: string, description: string): Promise<T> {
  console.log(`Fetching CLDR ${description}...`);

  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': 'grafana-regional-formats-generator',
  };

  // Use GitHub token if available for higher rate limits
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  const url = `https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/${path}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${description}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetches CLDR coverage levels from the unicode-org/cldr-json repository
 */
export async function fetchCLDRCoverageLevels(): Promise<CoverageLevelsData> {
  return fetchCLDRData<CoverageLevelsData>('cldr-core/coverageLevels.json', 'coverage levels');
}

/**
 * Fetches CLDR parent locales data from the unicode-org/cldr-json repository
 */
export async function fetchCLDRParentLocales(): Promise<ParentLocalesData> {
  return fetchCLDRData<ParentLocalesData>('cldr-core/supplemental/parentLocales.json', 'parent locales');
}

/**
 * Fetches CLDR territory information from the unicode-org/cldr-json repository
 * Contains information about countries, their languages, and language usage statistics
 */
export async function fetchCLDRTerritoryInfo(): Promise<TerritoryInfo['supplemental']['territoryInfo']> {
  const data = await fetchCLDRData<TerritoryInfo>('cldr-core/supplemental/territoryInfo.json', 'territory info');

  return data.supplemental.territoryInfo;
}
