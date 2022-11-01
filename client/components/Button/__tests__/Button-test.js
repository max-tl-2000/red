/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import Button from '../Button';
import { sleep } from '../../../../common/test-helpers/index';

describe('Button', () => {
  describe('onClick', () => {
    it('should be debounced by default by 1 second', async () => {
      const spy = jest.fn();
      const { container } = render(<Button onClick={spy} />);

      fireEvent.click(container.firstChild);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should properly debounce more than one 1 click event', async () => {
      const spy = jest.fn();
      const { container } = render(<Button onClick={spy} />);

      fireEvent.click(container.firstChild);
      expect(spy).toHaveBeenCalledTimes(1);
      await sleep(50);
      fireEvent.click(container.firstChild);
      await sleep(50);
      fireEvent.click(container.firstChild);

      expect(spy).toHaveBeenCalledTimes(1);
      await sleep(200);
      expect(spy).toHaveBeenCalledTimes(1);
      await sleep(500);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    describe('debounceClick = false', () => {
      describe('when debounceClick is false', () => {
        it('should fire as many clicks as events were fired', async () => {
          const spy = jest.fn();

          const { container } = render(<Button debounceClick={false} onClick={spy} />);

          fireEvent.click(container.firstChild);
          await sleep(50);
          fireEvent.click(container.firstChild);
          await sleep(50);
          fireEvent.click(container.firstChild);

          expect(spy).toHaveBeenCalledTimes(3);
        });
      });
    });
  });
  afterEach(cleanup);
});
