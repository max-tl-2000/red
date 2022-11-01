/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable jsx-a11y/media-has-caption */
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { cf } from './AudioPlayer.scss';
import Icon from '../Icon/Icon';
import Caption from '../Typography/Caption';
import { toMoment } from '../../../common/helpers/moment-utils';

export default class AudioPlayer extends Component {
  static propTypes = {
    src: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    onPlayed: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = { progressPercent: 0, time: '00:00' };
  }

  componentDidMount() {
    this.mounted = true;
    this.interval = setInterval(
      () =>
        this.mounted &&
        this.setState({
          progressPercent: this.progressPercent,
          time: this.time,
        }),
      40,
    );
  }

  componentWillUnmount() {
    this.mounted = false;
    this.interval && clearInterval(this.interval);
  }

  get progressPercent() {
    if (!this.audio) return 0;
    const { currentTime, duration } = this.audio;
    return (currentTime / duration) * 100;
  }

  get time() {
    if (!this.audio) return '00:00';
    const { currentTime, duration } = this.audio;
    return toMoment(0, { parseFormat: 'HH', strict: false })
      .add(currentTime || duration, 's')
      .format('mm:ss');
  }

  buttonClick = () => {
    this.audio.paused ? this.audio.play() : this.audio.pause();

    const { onPlayed } = this.props;
    const { wasPlayed } = this.state;

    if (!wasPlayed) {
      onPlayed && onPlayed();
      this.setState({ wasPlayed: true });
    }
  };

  progressUpdate = e => this.audio && (this.audio.currentTime = e.target.value);

  render = () => {
    const { src, onClick } = this.props;
    const { progressPercent, time } = this.state;

    return (
      <div className={cf('container')} onClick={e => onClick && onClick(e)}>
        <audio ref={e => (this.audio = e)}>
          <source src={src} type="audio/mpeg" />
        </audio>
        <div className={cf('button')} onClick={this.buttonClick}>
          <Icon name={this.audio && !this.audio.paused ? 'pause' : 'play'} />
        </div>
        <div className={cf('progress-background')}>
          <div className={cf('progress')} style={{ flexBasis: `${progressPercent}%` }} />
          <input
            type="range"
            min={0}
            max={(this.audio && this.audio.duration) || 0}
            value={(this.audio && this.audio.currentTime) || 0}
            step={0.01}
            onChange={this.progressUpdate}
          />
        </div>
        <Caption secondary>{time}</Caption>
      </div>
    );
  };
}
