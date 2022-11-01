/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const shouldCloseDialog = (wasCloseRequested, wasOperationCompleted, isOperationInProgress) =>
  wasCloseRequested && wasOperationCompleted && !isOperationInProgress;

export const dialogHasErrors = (savePostError, sendPostError) => savePostError || sendPostError;

export const isSaveInProgress = (savePostError, sendPostError, isOperationInProgress) => !savePostError && !sendPostError && isOperationInProgress;
