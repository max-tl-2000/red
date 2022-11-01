/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EditorState } from 'draft-js';

export const createOnFileDropFn = config => (selection, files, { getEditorState, setEditorState }) => {
  const { onFilesDropped } = config;

  if (onFilesDropped) {
    setEditorState(EditorState.acceptSelection(getEditorState(), selection));

    onFilesDropped({ getEditorState, setEditorState }, files);

    return 'handled';
  }

  return undefined;
};
