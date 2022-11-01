/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import addVideo from './video/modifiers/addVideo';
import { VideoComponent } from './video/components';
import * as types from './video/constants';

const videoPlugin = (config = {}) => {
  const theme = config?.theme;
  let Video = VideoComponent;
  if (config.decorator) {
    Video = config.decorator(Video);
  }
  const ThemedVideo = props => <Video {...props} theme={theme} horizontal="auto" vertical="auto" />;
  return {
    blockRendererFn: (block, { getEditorState }) => {
      if (block.getType() === types.ATOMIC) {
        const contentState = getEditorState().getCurrentContent();
        const entityKey = block.getEntityAt(0);
        if (!entityKey) return null;
        const entity = contentState.getEntity(entityKey);
        const type = entity.getType();
        const { src } = entity.getData();
        if (type === types.VIDEOTYPE) {
          return {
            component: ThemedVideo,
            editable: false,
            props: {
              src,
            },
          };
        }
      }

      return null;
    },
    addVideo,
    types,
  };
};

export default videoPlugin;
