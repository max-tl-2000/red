/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { cf, g } from './DialPad.scss';
import Caption from '../../components/Typography/Caption';
import Text from '../../components/Typography/Text';

const buttons = [
  {
    symbol: '1',
  },
  {
    symbol: '2',
    alias: 'abc',
  },
  {
    symbol: '3',
    alias: 'def',
  },
  {
    symbol: '4',
    alias: 'ghi',
  },
  {
    symbol: '5',
    alias: 'jkl',
  },
  {
    symbol: '6',
    alias: 'mno',
  },
  {
    symbol: '7',
    alias: 'pqrs',
  },
  {
    symbol: '8',
    alias: 'tuv',
  },
  {
    symbol: '9',
    alias: 'wxyz',
  },
  {
    symbol: '*',
  },
  {
    symbol: '0',
    alias: '+',
  },
  {
    symbol: '#',
  },
];

const handleButtonClicked = (onClick, button) => onClick && onClick(button);

const renderDialButton = ({ symbol, alias }) => (
  <div className={cf('dial-button')}>
    <Text secondary className={cf(g('display1'), 'dial-symbol')}>
      {symbol}
    </Text>
    <Caption secondary className={cf('dial-alias')}>
      {alias && alias.toUpperCase()}
    </Caption>
  </div>
);

const renderListItems = onClick =>
  buttons.map((button, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <li key={`dial-pad-${i}`} className={cf('list-item')} onClick={() => handleButtonClicked(onClick, button)}>
      {renderDialButton(button)}
    </li>
  ));

const DialPad = ({ className, onClick }) => (
  <div className={cf('main-content', g(className))}>
    <ol className={cf('list')}>{renderListItems(onClick)}</ol>
  </div>
);

export default DialPad;
