/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getStyles } from '../getStyles';

export const baseProps = () => ({
  lineHeight: '17.6px',
  fontFamily: 'Roboto, sans-serif',
  fontWeight: '400',
  margin: 0,
  color: '#212121',
});

export const body = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '13px',
    lineHeight: '20px',
    letterSpacing: '0.1px',
  };
};

export const caption = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '12px',
    lineHeight: '16x',
    letterSpacing: '0.2px',
  };
};

export const textButton = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '18px',
    letterSpacing: '0.1px',
  };
};

export const textTitle = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '20px',
    lineHeight: '28px',
    letterSpacing: '0.1px',
  };
};

export const subHeader = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '15px',
    lineHeight: '24px',
    letterSpacing: '0.1px',
  };
};

export const headline = () => {
  const res = baseProps();
  return {
    ...res,
    fontSize: '24px',
    lineHeight: '32px',
  };
};

export const lightError = (mode = 'dark') => {
  if (mode === 'light') {
    return { color: '#ff8a80' }; // $redA100: #ff8a80;
  }
  return { color: '#ff1744' }; // $redA400: #ff1744;
};

export const lightHighlight = (mode = 'dark') => {
  if (mode === 'light') {
    return { color: '#ea80fc' }; // $purpleA100: #ea80fc;
  }
  return { color: '#da21fa' }; // $purpleA400: #d500f9;
};

export const bold = () => ({
  fontWeight: 'bold',
});

export const textSecondary = (mode = 'dark') => {
  if (mode === 'light') {
    return { color: '#ffffff' };
  }
  return { color: '#757575' };
};

export const textPrimary = (mode = 'dark') => {
  if (mode === 'light') {
    return { color: '#ffffff' };
  }
  return { color: '#212121' };
};

export const textDisabled = (mode = 'dark') => {
  if (mode === 'light') {
    return { color: '#4d4d4d' };
  }
  return { color: '#bdbdbd' };
};

export const ellipsis = () => ({
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

const styles = {
  text: body(),
  'text-heavy': body(),
  headline: headline(),
  subheader: subHeader(),
  title: textTitle(),
  caption: caption(),
  link: {
    color: '#2196f3',
    cursor: 'pointer',
    textDecoration: 'none',
  },
};

export const getStyleFor = getStyles(styles);

export const getStyleForWithFlags = (name, opts = {}, extraProps = {}) => {
  const base = styles[name] || {};

  const mode = opts.lighter ? 'light' : 'dark';

  let output = { ...base, ...textPrimary(mode) };

  if (opts.secondary) {
    output = { ...output, ...textSecondary(mode) };
  }
  if (opts.highlight) {
    output = { ...output, ...lightHighlight(mode) };
  }
  if (opts.error) {
    output = { ...output, ...lightError(mode) };
  }
  if (opts.disabled) {
    output = { ...output, ...textDisabled(mode) };
  }
  if (opts.ellipsis) {
    output = { ...output, ...ellipsis() };
  }
  if (opts.bold) {
    output = { ...output, ...bold() };
  }

  output = { ...output, ...extraProps };

  return output;
};
