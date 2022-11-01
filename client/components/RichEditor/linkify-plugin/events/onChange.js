/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { RichUtils, Modifier, EditorState, SelectionState } from 'draft-js';

import { getUrlFromString, isURL } from '../utils';
/*
Returns the entityKey for the link entity the user is currently within.
*/
const getCurrentLinkEntityKey = editorState => {
  const contentState = editorState.getCurrentContent();
  const startKey = editorState.getSelection().getStartKey();
  const startOffset = editorState.getSelection().getStartOffset();
  const block = contentState.getBlockForKey(startKey);

  const linkKey = block.getEntityAt(Math.min(block.getText().length - 1, startOffset));

  if (linkKey) {
    const linkInstance = contentState.getEntity(linkKey);
    if (linkInstance.getType() === 'LINK') {
      return linkKey;
    }
  }
  return null;
};

const editorStateSettingLink = (editorState, selection, data) => {
  const contentState = editorState.getCurrentContent();
  let entityKey = getCurrentLinkEntityKey(editorState);

  let nextEditorState = editorState;

  if (!entityKey) {
    const contentStateWithEntity = contentState.createEntity('LINK', 'MUTABLE', data);
    entityKey = contentStateWithEntity.getLastCreatedEntityKey();
    nextEditorState = EditorState.set(editorState, {
      currentContent: contentStateWithEntity,
    });
    nextEditorState = RichUtils.toggleLink(nextEditorState, selection, entityKey);
  } else {
    nextEditorState = EditorState.set(editorState, {
      currentContent: editorState.getCurrentContent().replaceEntityData(entityKey, data),
    });
    nextEditorState = EditorState.forceSelection(nextEditorState, editorState.getSelection());
  }

  return nextEditorState;
};

const onChangeLinkifyEvent = editorState => {
  // Returns the current contents of the editor.
  let contentState = editorState.getCurrentContent();

  // Returns the current cursor/selection state of the editor.
  const selection = editorState.getSelection();

  if (!selection || !selection.isCollapsed()) {
    return editorState;
  }

  const cursorOffset = selection.getStartOffset();
  const cursorBlockKey = selection.getStartKey();
  const cursorBlock = contentState.getBlockForKey(cursorBlockKey);
  const cursorBlockType = cursorBlock.getType();

  // This is for the blocks that can have a link inside like a nested html element
  const blockTypesNested = ['header-one', 'header-two', 'ordered-list-item', 'unordered-list-item', 'blockquote'];

  if (cursorBlockType !== 'unstyled' && !blockTypesNested.includes(cursorBlockType)) {
    return editorState;
  }

  // Step 1: Get the word around the cursor by splitting the current block's text
  const text = cursorBlock.getText();
  const currentWordStart = text.lastIndexOf(' ', cursorOffset) + 1;
  let currentWordEnd = text.indexOf(' ', cursorOffset);
  if (currentWordEnd === -1) {
    currentWordEnd = text.length;
  }

  const currentWord = text.substr(currentWordStart, currentWordEnd - currentWordStart);

  const currentWordIsURL = isURL(currentWord);

  // Step 2: Find the existing LINK entity under the user's cursor
  let currentLinkEntityKey = cursorBlock.getEntityAt(Math.min(text.length - 1, cursorOffset));
  const inst = currentLinkEntityKey && contentState.getEntity(currentLinkEntityKey);
  if (inst && inst.getType() !== 'LINK') {
    currentLinkEntityKey = '';
  }

  if (currentLinkEntityKey) {
    // Note: we don't touch link values added / removed "explicitly" via the link
    // toolbar button. This means you can make a link with text that doesn't match the link.
    const entityExistingData = contentState.getEntity(currentLinkEntityKey).getData();
    if (entityExistingData.explicit) {
      return editorState;
    }

    if (currentWordIsURL) {
      // We are modifying the URL - update the entity to reflect the current text
      contentState = editorState.getCurrentContent();
      return EditorState.set(editorState, {
        currentContent: contentState.replaceEntityData(currentLinkEntityKey, {
          explicit: false,
          url: getUrlFromString(currentWord),
        }),
      });
    }
    // We are no longer in a URL but the entity is still present. Remove it from
    // the current character so the linkifying "ends".
    const entityRange = new SelectionState({
      anchorOffset: currentWordStart,
      anchorKey: cursorBlockKey,
      focusOffset: currentWordStart,
      focusKey: cursorBlockKey,
      isBackward: false,
      hasFocus: true,
    });
    return EditorState.set(editorState, {
      currentContent: Modifier.applyEntity(editorState.getCurrentContent(), entityRange, null),
    });
  }

  // There is no entity beneath the current word, but it looks like a URL. Linkify it!
  if (currentWordIsURL) {
    const entityRange = new SelectionState({
      anchorOffset: currentWordStart,
      anchorKey: cursorBlockKey,
      focusOffset: currentWordEnd,
      focusKey: cursorBlockKey,
      isBackward: false,
      hasFocus: false,
    });

    let newEditorState = editorStateSettingLink(editorState, entityRange, {
      explicit: false,
      url: getUrlFromString(currentWord),
    });

    // reset selection to the initial cursor to avoid selecting the entire links
    newEditorState = EditorState.acceptSelection(newEditorState, selection);
    return newEditorState;
  }

  return editorState;
};

export default onChangeLinkifyEvent;
