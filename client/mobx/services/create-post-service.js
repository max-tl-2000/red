/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createAuthAwareService } from './create-services';

export const createPostService = auth => {
  const uploadFilesFn = ({ files, clientFileId, postId, context }) => {
    const fd = new FormData();
    files.forEach(entry => {
      fd.append('files', entry);
      fd.append('postId', postId);
      fd.append('context', context);
      fd.append('clientFileId', clientFileId);
    });

    return fd;
  };

  const serviceDescriptor = {
    uploadFile: {
      method: 'POST',
      url: '/api/cohortComms/post/recipient',
      rawData: true,
      data: uploadFilesFn,
    },
    uploadPostImages: {
      method: 'POST',
      url: '/api/documents/public/images',
      rawData: true,
      data: uploadFilesFn,
    },
    deleteHeroImage: {
      method: 'DELETE',
      url: ({ fileId } = {}) => `/api/documents/public/images/${fileId}`,
    },
    uploadHeroImage: {
      method: 'POST',
      url: '/api/documents/public/images',
      rawData: true,
      data: uploadFilesFn,
    },
    getPosts: {
      method: 'GET',
      dataAsQueryParams: true,
      url: '/api/cohortComms/posts',
    },
    createPost: {
      method: 'POST',
      url: '/api/cohortComms/post',
    },
    updatePost: {
      method: 'PATCH',
      url: '/api/cohortComms/post',
    },
    deletePost: {
      method: 'DELETE',
      url: '/api/cohortComms/post',
    },
    deleteFile: {
      method: 'DELETE',
      url: '/api/cohortComms/post/recipient',
    },
    sendPost: {
      method: 'POST',
      url: '/api/cohortComms/post/send',
    },
    getDraftPosts: {
      method: 'GET',
      url: '/api/cohortComms/draftPosts',
    },
    getPostById: {
      method: 'GET',
      url: args => `api/cohortComms/post/${args.postId}`,
    },
    retractPost: {
      method: 'PATCH',
      url: '/api/cohortComms/post/retract',
    },
  };

  return createAuthAwareService(serviceDescriptor, auth);
};
