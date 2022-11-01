/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const YOUTUBE_URL_MATCHER = /^(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})(?:\S+)?$/;
const VIMEO_URL_MATCHER = /https?:\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/; // eslint-disable-line no-useless-escape

export default {
  isYoutube: url => YOUTUBE_URL_MATCHER.test(url),
  isVimeo: url => VIMEO_URL_MATCHER.test(url),
  getYoutubeSrc: url => {
    const videoIdMatchIndex = 1;
    const id = url && url.match(YOUTUBE_URL_MATCHER)[videoIdMatchIndex];
    return {
      srcID: id,
      srcType: 'youtube',
      url,
    };
  },
  getVimeoSrc: url => {
    const videoIdMatchIndex = 3;
    const id = url.match(VIMEO_URL_MATCHER)[videoIdMatchIndex];
    return {
      srcID: id,
      srcType: 'vimeo',
      url,
    };
  },
};
