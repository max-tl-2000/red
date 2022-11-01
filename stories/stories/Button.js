/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable react/prefer-stateless-function */
import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import Field from 'components/Form/Field';
import * as T from 'components/Typography/Typography';
import Block from '../helpers/Block';
import Button from '../../client/components/Button/Button';

class SimpleButton extends Component {
  render() {
    return (
      <Block>
        <T.FormattedBlock>
          <T.Title>Button stories</T.Title>
        </T.FormattedBlock>
        <Field inline columns={12} last>
          <table>
            <tbody>
              <tr>
                <td colSpan="2">
                  <T.Text>FLAT BUTTONS</T.Text>
                </td>
                <td colSpan="2">
                  <T.Text>RAISED BUTTONS</T.Text>
                </td>
              </tr>
              <tr>
                <td>
                  <T.Text>Primary</T.Text>
                </td>
                <td>
                  <T.Text>Secondary</T.Text>
                </td>
                <td>
                  <T.Text>Primary</T.Text>
                </td>
                <td>
                  <T.Text>Secondary</T.Text>
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="NORMAL" />
                </td>
                <td>
                  <Button type="flat" label="NORMAL" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="NORMAL" />
                </td>
                <td>
                  <Button type="raised" label="NORMAL" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="focused" className="focused" />
                </td>
                <td>
                  <Button type="flat" label="focused" className="focused" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="focused" className="focused" />
                </td>
                <td>
                  <Button type="raised" label="focused" className="focused" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="hovered" className="hovered" />
                </td>
                <td>
                  <Button type="flat" label="hovered" className="hovered" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="hovered" className="hovered" />
                </td>
                <td>
                  <Button type="raised" label="hovered" className="hovered" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="pressed" className="pressed" />
                </td>
                <td>
                  <Button type="flat" label="pressed" className="pressed" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="pressed" className="pressed" />
                </td>
                <td>
                  <Button type="raised" label="pressed" className="pressed" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="disabled" disabled />
                </td>
                <td>
                  <Button type="flat" label="disabled" btnRole="secondary" disabled />
                </td>
                <td>
                  <Button type="raised" label="disabled" disabled />
                </td>
                <td>
                  <Button type="raised" label="disabled" btnRole="secondary" disabled />
                </td>
              </tr>
            </tbody>
          </table>
        </Field>
      </Block>
    );
  }
}

storiesOf('Button', module).addWithInfo('Simple Button', 'All types of button usage', () => <SimpleButton />, {
  propTables: [Button],
});
