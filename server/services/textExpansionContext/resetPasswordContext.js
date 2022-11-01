/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { VIEW_MODEL_TYPES } from './enums';
import { config } from '../../../common/publicImagesHelper';
import { getLayoutImage, getImageForEmail } from '../../../common/helpers/cloudinary';

export const viewModelType = VIEW_MODEL_TYPES.OBJECT;

export const noDbQuery = true;

export const tokensMapping = {
  resetPassword: {
    heroImageUrl: ({ tokenParams }) => {
      const imageUrl = `${config.publicUrl}/email-forgot-password.jpg`;
      return tokenParams.length ? getImageForEmail(imageUrl, tokenParams) : getLayoutImage(imageUrl, { height: 190 });
    },
  },
};
