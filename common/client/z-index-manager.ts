/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ZIndexHelper } from './z-index-helper';

export class ZIndexManager {
  baseZIndex: number;

  openedOverlays = new Map();

  constructor({ baseZIndex = 200 } = {}) {
    this.baseZIndex = baseZIndex;
  }

  pushOverlay(id: string, entry: ZIndexHelper) {
    this.openedOverlays.set(id, entry);
    return this.getTopMostZIndex();
  }

  removeOverlay(id: string) {
    const entry = this.openedOverlays.get(id);
    entry && entry.clearZIndex && entry.clearZIndex();
    this.openedOverlays.delete(id);
  }

  findTopMostZIndex(): number {
    return Array.from(this.openedOverlays.values()).reduce((acc, entry) => {
      const zIndex = entry.getZIndex();
      if (acc < zIndex) acc = zIndex;

      return acc;
    }, -1);
  }

  getTopMostZIndex(): number {
    const topMostZIndex = this.findTopMostZIndex();

    if (topMostZIndex === -1) return this.baseZIndex + 1;
    return topMostZIndex + 1;
  }
}
