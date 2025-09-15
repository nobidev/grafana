import { createTheme, FieldType, toDataFrame } from '@grafana/data';

import { prepareHeatmapData } from './fields';
import { Options } from './types';

const theme = createTheme();

describe('Heatmap data', () => {
  const options: Options = {
    color: { min: 0, max: 100 },
  } as Options;

  it('should handle empty data gracefully', () => {
    const result = prepareHeatmapData({
      frames: [],
      options,
      palette: ['#000'],
      theme,
    });
    expect(result).toEqual({});
  });

  it('should process valid heatmap data successfully', () => {
    const frames = [
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'A', type: FieldType.number, values: [1.1, 1.2, 1.3] },
          { name: 'B', type: FieldType.number, values: [2.1, 2.2, 2.3] },
        ],
      }),
    ];

    const result = prepareHeatmapData({
      frames,
      options: {
        ...options,
        calculate: false,
      },
      palette: ['#000', '#fff'],
      theme,
    });

    expect(result.heatmap).not.toBeNull();
    expect(result.heatmap?.fields[0].values).toEqual([1, 1, 2, 2, 3, 3]);
    expect(result.heatmap?.fields[1].values).toEqual([0, 1, 0, 1, 0, 1]);
    expect(result.heatmap?.fields[2].values).toEqual([1.1, 2.1, 1.2, 2.2, 1.3, 2.3]);
    expect(result.heatmap?.meta?.type).toBe('heatmap-cells');
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
