/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import sleep from 'helpers/sleep';
import { render, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiTextBox from '../MultiTextBox';

describe('<MultiTextBox />', () => {
  afterEach(cleanup);
  it('should render an empty TextBox if no values are provided', () => {
    const { container } = render(<MultiTextBox />);
    const textbox = container.querySelector('input[type="text"]');
    const allTextboxes = container.querySelectorAll('input[type="text"]');

    expect(textbox.value).toEqual('');
    expect(allTextboxes.length).toEqual(1);
  });

  it('should render as many textboxes as values are provided', () => {
    const { container } = render(
      <MultiTextBox
        values={[
          { id: 1, value: 'textbox1' },
          { id: 2, value: 'textbox2' },
          { id: 3, value: 'textbox3' },
        ]}
      />,
    );

    const textboxes = container.querySelectorAll('input[type="text"]');

    expect(textboxes.length).toEqual(3);
    expect(textboxes[0].value).toEqual('textbox1');
    expect(textboxes[1].value).toEqual('textbox2');
    expect(textboxes[2].value).toEqual('textbox3');
  });

  it('should render as many textboxes as values are provided', () => {
    const { container } = render(
      <MultiTextBox
        values={[
          { id: 1, value: 'textbox1', error: '' },
          { id: 2, value: 'textbox2', error: '' },
          { id: 3, value: 'textbox3', error: '' },
        ]}
      />,
    );

    let textboxes = container.querySelectorAll('input[type="text"]');
    expect(textboxes.length).toEqual(3);

    const { container: container2 } = render(<MultiTextBox values={[{ id: 5, value: 'new textbox 1', error: '' }]} />);

    textboxes = container2.querySelectorAll('input[type="text"]');
    expect(textboxes.length).toEqual(1);
  });

  describe('clear', () => {
    it('calling clear on the instance should remove all the values', () => {
      const { container: c1 } = render(
        <MultiTextBox
          values={[
            { id: 1, value: 'textbox1' },
            { id: 2, value: 'textbox2' },
          ]}
        />,
      );

      let textboxes = c1.querySelectorAll('input[type="text"]');
      expect(textboxes.length).toEqual(2);

      const { container: c2 } = render(<MultiTextBox values={[]} />);

      textboxes = c2.querySelectorAll('input[type="text"]');

      expect(textboxes.length).toEqual(1);
      expect(textboxes[0].value).toEqual('');
    });
  });

  describe('values', () => {
    it('allow to set values to the component', () => {
      const { container: c1 } = render(<MultiTextBox />);

      let textboxes = c1.querySelectorAll('input[type="text"]');
      expect(textboxes.length).toEqual(1);
      expect(textboxes[0].value).toEqual('');

      const { container: c2 } = render(
        <MultiTextBox
          values={[
            { id: 1, value: 'hello' },
            { id: 2, value: 'world' },
          ]}
        />,
      );
      textboxes = c2.querySelectorAll('input[type="text"]');

      expect(textboxes.length).toEqual(2);
      expect(textboxes[0].value).toEqual('hello');
      expect(textboxes[1].value).toEqual('world');
    });

    it('should allow empty as the value to be set', () => {
      render(
        <MultiTextBox
          values={[
            { id: 1, value: 'hello' },
            { id: 2, value: 'world' },
          ]}
        />,
      );
      const { container: c1 } = render(<MultiTextBox values={[]} />);

      const textboxes = c1.querySelectorAll('input[type="text"]');
      expect(textboxes[0].value).toEqual('');
      expect(textboxes.length).toEqual(1);
    });

    it('allows to retrieve the values set on the component', async () => {
      let stateValues = [];
      const setState = ({ values }) => {
        stateValues = values;
      };

      const { container } = render(<MultiTextBox raiseChangeThreshold={0} onChange={setState} />);

      let input = container.querySelectorAll('input[type="text"]')[0];

      // first focus will remove the original textbox but
      // will replace it with a new instance that is already in edit mode
      fireEvent.focus(input);

      await sleep(100);

      input = container.querySelectorAll('input[type="text"]')[0];

      userEvent.type(input, 'hello world');
      await sleep(100);

      const addBtn = container.querySelector('[data-part="add-trigger"]');

      fireEvent.click(addBtn);

      await sleep(1100);

      input = container.querySelectorAll('input[type="text"]')[1];

      userEvent.type(input, 'foo bar');
      await sleep(100);

      fireEvent.click(container.querySelector('[data-part="add-trigger"]'));
      await sleep(1100);

      input = container.querySelectorAll('input[type="text"]')[2];
      userEvent.type(input, 'typing works');
      await sleep(100);

      expect(stateValues.map(item => item.value)).toEqual(['hello world', 'foo bar', 'typing works']);
    });
  });

  describe('nonEmptyValues', () => {
    it('should return only the values that are nonEmpty', async () => {
      let stateValues = [];
      const setState = ({ nonEmptyValues }) => {
        stateValues = nonEmptyValues;
      };

      const { container } = render(<MultiTextBox raiseChangeThreshold={0} onChange={setState} />);

      let input = container.querySelectorAll('input[type="text"]')[0];

      // first focus will remove the original textbox but
      // will replace it with a new instance that is already in edit mode
      fireEvent.focus(input);

      await sleep(100);

      const firstInput = container.querySelectorAll('input[type="text"]')[0];

      userEvent.type(firstInput, 'hello world');
      await sleep(100);

      const addBtn = container.querySelector('[data-part="add-trigger"]');

      fireEvent.click(addBtn);

      await sleep(1100);

      input = container.querySelectorAll('input[type="text"]')[1];

      userEvent.type(input, 'foo bar');
      await sleep(100);

      fireEvent.click(container.querySelector('[data-part="add-trigger"]'));
      await sleep(1100);

      input = container.querySelectorAll('input[type="text"]')[2];
      userEvent.type(input, 'typing works');
      await sleep(100);
      userEvent.type(firstInput, '');
      await sleep(100);
      expect(stateValues.map(item => item.value)).toEqual(['hello world', 'foo bar', 'typing works']);
    });
  });

  describe('unmount', () => {
    it('should not throw', () => {
      render(
        <MultiTextBox
          values={[
            { id: 3, value: 'foo' },
            { id: 4, value: 'bar' },
          ]}
        />,
      );
      cleanup();
    });
  });

  describe('props', () => {
    it('should render a label if one is provided', () => {
      const { container } = render(
        <MultiTextBox
          label="Some label"
          values={[
            { id: 3, value: 'foo' },
            { id: 4, value: 'bar' },
          ]}
        />,
      );
      const label = container.querySelector('label');
      expect(label.innerHTML).toEqual('Some label');
    });

    it('should render an error if one is provided', () => {
      const { container } = render(
        <MultiTextBox
          errorMessage="Some error message"
          values={[
            { id: 3, value: 'foo' },
            { id: 4, value: 'bar' },
          ]}
        />,
      );
      const validators = container.querySelectorAll('[data-component="validator"]');
      expect(validators.length).toEqual(1);
      expect(validators[0].textContent).toEqual('Some error message');
    });
  });
});
