/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { EditorState, convertToRaw } from 'draft-js';
import { stateToHTML } from 'draft-js-export-html';
import {
  RICH_TEXT_COMMENTS_MATCHER,
  TRIM_WHITE_SPACES,
  YOUTUBE_VIDEO_ID_MATCHER,
  VIMEO_VIDEO_ID_MATCHER,
  REPLACE_P_TAGS,
  STRING_BREAK_LINES,
  MATCH_EDITOR_COMPONENTS,
  BREAKLINE,
} from '../../common/regex';

const maxEmptyNewLines = 5;

const replaceSrcWithValidEmbedSrc = src => {
  const youtubeMatch = src.match(YOUTUBE_VIDEO_ID_MATCHER);
  const vimeoMatch = src.match(VIMEO_VIDEO_ID_MATCHER);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[5]}`;
  }
  return '';
};

const stateToHtmlOptions = {
  blockRenderers: {
    divider: () => '<div><hr></div>',
  },
  entityStyleFn: entity => {
    const entityType = entity.get('type').toLowerCase();
    const data = entity.getData();
    const { src } = data;
    if (entityType === 'video' && src) {
      const newSrc = replaceSrcWithValidEmbedSrc(src);
      return {
        element: 'iframe',
        attributes: {
          src: `${newSrc}`,
        },
      };
    }
    return null;
  },
  inlineStyles: {
    CODE: { attributes: { class: 'codeBlock' } },
  },
};

const removeHTMLComments = value => value?.replace(RICH_TEXT_COMMENTS_MATCHER, '');

export const areRichTextFieldsEqual = (firstField = '', secondField = '') => {
  const firstFieldValue = removeHTMLComments(firstField);
  const secondFieldValue = removeHTMLComments(secondField);
  return firstFieldValue === secondFieldValue;
};

const isBlockTypeValid = type => type === 'atomic' || type === 'divider';

const getEmptyNewLineBlocks = (blocks, removeTrailingSpaces) => {
  let blocksIdsToRemove = [];
  let emptyLines = [];
  let leadingLines = true;
  for (let i = 0; i < blocks.length; i++) {
    const currentLineTypeValid = isBlockTypeValid(blocks[i]?.getType());
    let currentLineText = blocks[i]?.getText();
    currentLineText = currentLineText.replace(TRIM_WHITE_SPACES, '');
    if (!currentLineText && !currentLineTypeValid && blocks.length > 1) {
      emptyLines.push(blocks[i].key);
    } else {
      if (emptyLines.length > 0) {
        if (leadingLines) {
          blocksIdsToRemove = emptyLines;
        } else if (emptyLines.length > maxEmptyNewLines) {
          const slicedEmptyLines = emptyLines.slice(maxEmptyNewLines);
          blocksIdsToRemove = blocksIdsToRemove.concat(slicedEmptyLines);
        }
      }
      emptyLines = [];
      leadingLines = false;
    }
  }
  if (removeTrailingSpaces) {
    blocksIdsToRemove = blocksIdsToRemove.concat(emptyLines);
  }
  return blocksIdsToRemove;
};

const editorStateToHtml = editorState => {
  const currentContent = editorState.getCurrentContent();
  const stateToHtml = stateToHTML(currentContent, stateToHtmlOptions);
  const contentWithSpans = stateToHtml.replace(REPLACE_P_TAGS, '$1span$2');
  const contentArray = contentWithSpans.split(BREAKLINE);
  const newContent = contentArray.reduce((acc, item) => {
    if (item.match(MATCH_EDITOR_COMPONENTS)) {
      acc.push(item);
    } else {
      acc.push(`${item}<br />`);
    }
    return acc;
  }, []);
  return newContent.join('');
};

const removeBlocksFromEditorState = (editorState, blocksIdsToRemove) => {
  let newEditorState = editorState;
  const currentContent = editorState.getCurrentContent();
  if (!blocksIdsToRemove?.length) {
    return newEditorState;
  }

  const blockMap = currentContent.getBlockMap();
  let newBlockMap = blockMap;
  blocksIdsToRemove.forEach(id => {
    newBlockMap = newBlockMap.filter(block => block.key !== id);
  });
  const newContentState = currentContent.merge({
    blockMap: newBlockMap,
  });
  newEditorState = EditorState.push(editorState, newContentState, 'remove-range');
  return newEditorState;
};

export const removeExtraNewLineBlocks = (editorState, removeTrailingSpaces = false, returnAsHtml = false, returnAsJsonBlocks = false) => {
  if (editorState) {
    const currentContent = editorState.getCurrentContent();
    const blocks = currentContent.getBlocksAsArray();
    const blocksIdsToRemove = getEmptyNewLineBlocks(blocks, removeTrailingSpaces);
    const newEditorStateWithoutBlocksToRemove = removeBlocksFromEditorState(editorState, blocksIdsToRemove, returnAsHtml);
    if (returnAsHtml) {
      return editorStateToHtml(newEditorStateWithoutBlocksToRemove);
    }
    if (returnAsJsonBlocks) {
      return JSON.stringify(convertToRaw(newEditorStateWithoutBlocksToRemove.getCurrentContent()));
    }
    return newEditorStateWithoutBlocksToRemove;
  }
  return '';
};
export const formatRichTextBreakLines = html => html?.replace(STRING_BREAK_LINES, '<br/>');
