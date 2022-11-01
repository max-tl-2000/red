/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { parseMetadataInFilePath, parseMetadataInRxpFilePath, validateMarketingAsset } from '../assets-helper';

describe('assetsHelper', () => {
  describe('when parseMetadataInFilePath is called', () => {
    it('should extract metadata (highValue, floorPlan, rank, label)', () => {
      const resultMetadata = [];
      ['01-FP-HV-some name.ext', '01-Office.jpg', '02-FP-1x1 TH 691-799 SF.png', '01 - Living dining.jpg', '02-HV-Patio.jpg', 'HV-Patio.jpg'].forEach(
        fileName => {
          const parsed = parseMetadataInFilePath(fileName);
          resultMetadata.push({ fileName, ...parsed });
        },
      );
      expect(resultMetadata).toMatchSnapshot();
    });
  });

  describe('when parseMetadataInRxpFilePath is called', () => {
    describe('and filename is correct', () => {
      it('should extract metadata (dimensions, shape, theme)', () => {
        const resultMetadata = [];
        ['64x64-square-dark.png', '64x64-square-dark.jpg', '32x32-square-dark.png', '32x32-circle-dark.png', '32x32-circle-light.png'].forEach(fileName => {
          const parsed = parseMetadataInRxpFilePath({}, fileName);
          resultMetadata.push(parsed);
        });
        expect(resultMetadata).toMatchSnapshot();
      });
    });

    describe('and filename is incorrect', () => {
      it('should throw error: INCORRECT_RXP_ASSET_NAME', () => {
        const result = [];
        ['square-dark.png', '64x64.square.dark.jpg', '32x32.png'].forEach(fileName => {
          try {
            parseMetadataInRxpFilePath({}, fileName);
          } catch (ex) {
            result.push(ex.message);
          }
        });
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('when validateMarketingAsset is called', () => {
    [
      {
        fileName: 'Dylan_BlackLogo.png',
        result: {
          success: true,
          errors: [],
        },
      },
      {
        fileName: 'invalid-file-size.png.png',
        result: {
          success: false,
          errors: [
            {
              token: 'INVALID_FILE_SIZE',
              message: 'Limited to 2.5 megabytes',
            },
          ],
        },
      },
      {
        fileName: 'invalid file %$@| name.png',
        result: {
          success: false,
          errors: [
            {
              token: 'INVALID_CHARACTERS',
              message: ' %$@|',
            },
          ],
        },
      },
      {
        fileName: 'invalid-file-name-size-and-invalid-characters #d.png',
        result: {
          success: false,
          errors: [
            {
              token: 'INVALID_CHARACTERS',
              message: ' #',
            },
            {
              token: 'INVALID_FILENAME_SIZE',
              message: 'Limited to 50 charcaters',
            },
          ],
        },
      },
    ].forEach(data => {
      it(`should validate ${data.fileName} returning valid ${data.result.success}`, () => {
        const filePath = path.resolve(path.dirname(__dirname), '__tests__', 'assets', data.fileName);
        const result = validateMarketingAsset(filePath, { fileNameLength: 50 });
        expect(result.success).toEqual(data.result.success);
        expect(result).toEqual(data.result);
      });
    });
  });
});
