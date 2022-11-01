/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable jsx-a11y/iframe-has-title */
import React from 'react';
import PropTypes from 'prop-types';
import utils from '../utils';
import { cf } from './VideoComponent.scss';

const YOUTUBE_PREFIX = 'https://www.youtube.com/embed/';
const VIMEO_PREFIX = 'https://player.vimeo.com/video/';

const getSrc = ({ src }) => {
  const { isYoutube, getYoutubeSrc, isVimeo, getVimeoSrc } = utils;
  if (isYoutube(src)) {
    const { srcID } = getYoutubeSrc(src);
    return `${YOUTUBE_PREFIX}${srcID}`;
  }
  if (isVimeo(src)) {
    const { srcID } = getVimeoSrc(src);
    return `${VIMEO_PREFIX}${srcID}`;
  }
  return undefined;
};

const VideoComponent = ({ blockProps, className = '', style }) => {
  const src = getSrc(blockProps);
  if (src) {
    return (
      <div style={style}>
        <div className={`${cf('iframeContainer')} ${className}`}>
          <iframe className={cf('iframe')} src={src} frameBorder="0" allowFullScreen />
        </div>
      </div>
    );
  }

  return <div className={cf('invalidVideoSrc')}>Invalid video source</div>;
};

VideoComponent.propTypes = {
  blockProps: PropTypes.object.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  theme: PropTypes.object,
};
export default VideoComponent;
