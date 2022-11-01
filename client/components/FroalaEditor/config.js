/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const editorDefaultFontFamily = 'sans-serif,Arial,Helvetica';
export const editorDefaultFontSize = '13';
const editorFontSizes = [editorDefaultFontSize, '18', '32'];

export const getConfig = ({ froalaEditor, toolbarId, height = null }) => ({
  fullPage: true,
  useClasses: false,
  toolbarBottom: true,
  listAdvancedTypes: false,
  quickInsertEnabled: false,
  emoticonsUseImage: false,
  linkAlwaysBlank: true,
  enter: froalaEditor.ENTER_DIV,
  imageUpload: false,
  toolbarContainer: `#${toolbarId}`,
  htmlAllowComments: true,
  iframeStyle: `body{ padding:0px; font-size:${editorDefaultFontSize}px; font-family:${editorDefaultFontFamily}; }`,
  fontFamily: {
    "serif,'Times New Roman',Times": 'Serif',
    editorDefaultFontFamily: 'Sans Serif',
  },
  fontSize: editorFontSizes,
  fontSizeDefaultSelection: editorDefaultFontSize,
  toolbarButtons: {
    moreText: {
      buttons: [
        'attachFile',
        'bold',
        'italic',
        'underline',
        'strikeThrough',
        'customFontSize',
        'fontFamily',
        'textColor',
        'backgroundColor',
        'pre',
        'clearFormatting',
      ],
      buttonsVisible: 1,
    },
    moreParagraph: {
      buttons: ['blockquote', 'alignLeft', 'alignCenter', 'formatUL', 'formatOLSimple'],
      buttonsVisible: 0,
    },
    moreRich: {
      buttons: ['emoticons', 'insertLink', 'insertHR'],
      buttonsVisible: 3,
    },
  },
  pluginsEnabled: [
    'codeView',
    'fontSize',
    'fontFamily',
    'colors',
    'quote',
    'paragraphFormat',
    'paragraphStyle',
    'draggable',
    'align',
    'link',
    'lists',
    'image',
    'emoticons',
    'url',
    'entities',
    'inlineClass',
    'inlineStyle',
  ],
  heightMin: height || 390,
  heightMax: height || 390,
  events: {
    keydown({ key, metaKey, ctrlKey }) {
      if (key === 'Enter' && (metaKey || ctrlKey)) {
        this.sendMessage();
      }
    },
  },
  iframeStyleFiles: ['https://cdnjs.cloudflare.com/ajax/libs/froala-editor/3.2.6/css/froala_style.min.css'],
  key: 'Ja2A4wA3C2E1E1C4B3nDc2YRTYKg1Dc2a1JVVG1VJKKYLMPvA1E1I1C2B8C7E7E1F5H5==',
  pastePlain: true,
});
