/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ZIndexManager } from '../z-index-manager';
import { ZIndexHelper } from '../z-index-helper';

describe('z-index helper', () => {
  describe('Push Overlay', () => {
    describe('when no overlays are registered', () => {
      it('should return a valid z-index based on the baseZIndex', () => {
        const dialog = new ZIndexHelper();
        const zIndexManager = new ZIndexManager();
        const validZIndex = zIndexManager.pushOverlay('dialog', dialog);
        expect(validZIndex).toBe(201);
      });
    });

    describe('when 2 overlays are registered', () => {
      it('should return a z-index that is greater than the previous one', () => {
        const zIndexManager = new ZIndexManager();

        const dialog1 = new ZIndexHelper();
        dialog1.zIndex = zIndexManager.pushOverlay('dialog1', dialog1);

        const dialog2 = new ZIndexHelper();
        const validZIndex2 = zIndexManager.pushOverlay('dialog2', dialog2);

        expect(validZIndex2).toBe(202);
        expect(validZIndex2).toBeGreaterThan(dialog1.zIndex);
      });
    });

    describe('when 3 overlays are registered', () => {
      it('should return a z-index that is greater than the previous one for of all them', () => {
        const zIndexManager = new ZIndexManager();

        const dialog1 = new ZIndexHelper();
        dialog1.zIndex = zIndexManager.pushOverlay('dialog1', dialog1);

        const dialog2 = new ZIndexHelper();
        dialog2.zIndex = zIndexManager.pushOverlay('dialog2', dialog2);

        const dialog3 = new ZIndexHelper();
        dialog3.zIndex = zIndexManager.pushOverlay('dialog3', dialog3);

        expect(dialog1.zIndex).toBe(201);
        expect(dialog2.zIndex).toBe(202);
        expect(dialog3.zIndex).toBe(203);
      });

      describe('and the second one is removed and added again', () => {
        it('should return a z-index that is greater than the last dialog z-index', () => {
          const zIndexManager = new ZIndexManager();

          const dialog1 = new ZIndexHelper();
          dialog1.zIndex = zIndexManager.pushOverlay('dialog1', dialog1);

          const dialog2 = new ZIndexHelper();
          dialog2.zIndex = zIndexManager.pushOverlay('dialog2', dialog2);

          const dialog3 = new ZIndexHelper();
          dialog3.zIndex = zIndexManager.pushOverlay('dialog3', dialog3);

          zIndexManager.removeOverlay('dialog2');
          dialog2.zIndex = zIndexManager.pushOverlay('dialog2', dialog2);

          expect(dialog2.zIndex).toBe(204);
        });
      });

      describe('and the second one is removed and added again', () => {
        it('should return a z-index that is greater than the last dialog z-index', () => {
          const zIndexManager = new ZIndexManager();

          const dialog1 = new ZIndexHelper();
          dialog1.zIndex = zIndexManager.pushOverlay('dialog1', dialog1);

          const dialog2 = new ZIndexHelper();
          dialog2.zIndex = zIndexManager.pushOverlay('dialog2', dialog2);

          const dialog3 = new ZIndexHelper();
          dialog3.zIndex = zIndexManager.pushOverlay('dialog3', dialog3);

          zIndexManager.removeOverlay('dialog3');
          dialog3.zIndex = zIndexManager.pushOverlay('dialog3', dialog3);

          expect(dialog3.zIndex).toBe(203);
        });
      });
    });
  });
});
