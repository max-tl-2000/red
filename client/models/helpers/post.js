/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from '../../helpers/mediator';
import { deferred } from '../../../common/helpers/deferred';
import EventTypes from '../../../common/enums/eventTypes';

export const performSendPost = ({ sendPost, postData }) => {
  const { postId } = postData;
  const dfd = deferred();

  const clearEventListeners = () => {
    mediator.off(`${EventTypes.POST_SENT}_${postId}`);
    mediator.off(`${EventTypes.POST_SENT_FAILURE}_${postId}`);
  };

  mediator.one(`${EventTypes.POST_SENT}_${postId}`, (e, args) => {
    if (args?.post?.id === postId) {
      clearEventListeners();
      dfd.resolve(args.post);
    }
  });
  mediator.one(`${EventTypes.POST_SENT_FAILURE}_${postId}`, (e, args) => {
    if (args.postId === postId) {
      clearEventListeners();
      dfd.reject(args.errorMessage);
    }
  });

  // deferred can timeout, so if that happens we just remove the listeners from here.
  dfd.catch(clearEventListeners);

  const p = sendPost(postData);

  // needed to make this call abortable
  dfd.abort = () => {
    p?.abort?.();
  };

  p.catch(dfd.reject);

  return dfd;
};

export const uploadFileToDocumentsUsingQueue = ({ uploadFile, uploadFileInfo }) => {
  const { clientFileId } = uploadFileInfo;
  const dfd = deferred({ timeout: 20000, id: 'UPLOAD_FILE_DEFERRED' });

  const clearEventListeners = () => {
    mediator.off(`${EventTypes.DOCUMENTS_UPLOADED}_${clientFileId}`);
    mediator.off(`${EventTypes.DOCUMENTS_UPLOADED_FAILURE}_${clientFileId}`);
  };

  mediator.one(`${EventTypes.DOCUMENTS_UPLOADED}_${clientFileId}`, (e, args) => {
    clearEventListeners();
    dfd.resolve(args);
  });

  mediator.one(`${EventTypes.DOCUMENTS_UPLOADED_FAILURE}_${clientFileId}`, (e, args) => {
    clearEventListeners();
    dfd.reject(args.errorMessage);
  });

  dfd.catch(clearEventListeners);

  const p = uploadFile(uploadFileInfo);

  dfd.abort = () => {
    p?.abort?.();
  };

  p.onUploadProgress = (...args) => {
    dfd?.onUploadProgress(...args);
  };

  p.catch(dfd.reject);

  return dfd;
};
