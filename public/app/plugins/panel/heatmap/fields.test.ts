import { createTheme, FieldType, toDataFrame } from '@grafana/data';

import { prepareHeatmapData } from './fields';
import { Options } from './types';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: Options = {} as Options;

  it('should handle empty data gracefully', () => {
    const result = prepareHeatmapData({
      frames: [],
      options,
      palette: ['#000'],
      theme,
    });
    expect(result).toEqual({});
  });

  it('should handle data with only time field gracefully', () => {
    const frames = [
      toDataFrame({
        fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
      }),
    ];

    expect(() => {
      prepareHeatmapData({
        frames,
        options,
        palette: ['#000'],
        theme,
      });
    }).toThrow('No numeric fields found for heatmap');
  });

  it('should handle calculate mode with no valid fields gracefully', () => {
    const frames = [
      toDataFrame({
        fields: [{ name: 'time', type: FieldType.time, values: [1, 2, 3] }],
      }),
    ];

    const calculateOptions = { ...options, calculate: true };

    expect(() => {
      prepareHeatmapData({
        frames,
        options: calculateOptions,
        palette: ['#000'],
        theme,
      });
    }).toThrow('no heatmap fields found');
  });
});
