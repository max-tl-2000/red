/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('export/MRI', () => {
  describe('/assignItems', () => {
    describe('when there are multiple inventories with the same type and id', () => {
      it('should export each one only once', async () => {
        const postFileMock = jest.fn();
        mockModules({
          '../mri/mriIntegration': {
            postFile: postFileMock,
          },
        });
        mockModules({
          '../mri/xmlUtils': {
            transformMapsToXML: jest.fn(),
          },
        });

        const data = {
          feesToExport: [
            {
              inventories: [
                {
                  itemType: 'DET',
                  itemId: '101',
                },
              ],
            },
            {
              inventories: [
                {
                  itemType: 'DET',
                  itemId: '101',
                },
              ],
            },
          ],
          externalInfo: { externalId: '123' },
          party: { id: 'e1ccec61-6f03-46c6-b64c-606ef24f1db1' },
        };

        const exporters = require('../mri/mriExporters'); // eslint-disable-line global-require
        const { executeAssignItems } = exporters;
        await executeAssignItems({}, data, { mapper: jest.fn() });
        expect(postFileMock.mock.calls.length).toBe(1);
      });
    });
  });
});
