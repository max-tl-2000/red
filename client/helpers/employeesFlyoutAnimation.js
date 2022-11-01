/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export default ({ open, animProps }) => {
  animProps.animation = {
    scaleY: open ? 1 : 0,
    opacity: open ? 1 : 0,
    translateY: open ? 0 : '-10%',
    transformOriginX: ['50%', '50%'],
    transformOriginY: ['0', '0'],
  };
};
