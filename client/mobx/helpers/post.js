/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';

export const EMERGENCY_MESSAGE_CHARACTERS_LIMIT = 500;
export const ANNOUNCEMENT_MESSAGE_CHARACTERS_LIMIT = 500;
export const ANNOUNCEMENT_MESSAGE_DETAILS_CHARACTERS_LIMIT = 10000;
export const MIN_ANNOUNCEMENT_MESSAGE_CHARACTERS_REMAINING = 100;
export const POST_TITLE_CHARACTERS_LIMIT = 100;
export const MAX_TITLE_LENGTH_FOR_SNACKBAR = 20;

export const initializePost = (postStore, formModel, postCategory) => {
  const initialData = { category: postCategory };

  if (!postStore.currentPost) {
    postStore.postEditorModel.initializeModels(formModel(initialData));
    return;
  }

  initialData.title = postStore.currentPost.title;
  initialData.message = postStore.currentPost.message;
  if (postCategory === DALTypes.PostCategory.ANNOUNCEMENT) {
    initialData.rawMessage = postStore.currentPost.rawMessage;
    initialData.messageDetails = postStore.currentPost.messageDetails;
    initialData.rawMessageDetails = postStore.currentPost.rawMessageDetails;
    initialData.rawMessageDetailsEditorContent = '';
    initialData.rawMessageEditorContent = '';
  }
  postStore.postEditorModel.initializeModels(formModel(initialData), postStore.currentPost);
};
