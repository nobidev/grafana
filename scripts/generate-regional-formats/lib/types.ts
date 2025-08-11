export type CoverageLevel = 'modern' | 'basic' | 'moderate';

export interface CoverageLevelsData {
  coverageLevels: Record<string, CoverageLevel>;
  effectiveCoverageLevels: Record<string, CoverageLevel>;
}

export interface LocaleTableRow {
  locale: string;
  languageName: string;
  formatted: string;
}

export interface ParentLocalesData {
  supplemental: {
    parentLocales: {
      parentLocale: Record<string, string>;
    };
  };
}

export interface TerritoryInfo {
  supplemental: {
    territoryInfo: Record<
      string,
      {
        _gdp: number;
        _literacyPercent: number;
        _population: number;
        languagePopulation: Record<
          string,
          {
            _literacyPercent?: number;
            _populationPercent: string;
            _writingPercent?: number;
            _officialStatus?: string;
          }
        >;
      }
    >;
  };
}
