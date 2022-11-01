/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import FileUpload from '../FileUpload';

describe('FileUpload', () => {
  it('should allow zip and xlsx files by default', () => {
    const fUpload = mount(<FileUpload multiple={false} />);

    fUpload.instance().handleDrop([{ name: 'hello.zip', size: 200, type: 'application/zip' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.zip
        </p>,
      ),
    ).toEqual(true);

    fUpload.instance().handleDrop([{ name: 'hello.xlsx', size: 200, type: 'application/vnd.ms-excel' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.xlsx
        </p>,
      ),
    ).toEqual(true);
  });

  it('should allow zip and xlsx files by default even in systems that will not provide a mime type', () => {
    const fUpload = mount(<FileUpload multiple={false} />);

    fUpload.instance().handleDrop([{ name: 'hello.zip', size: 200, type: '' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.zip
        </p>,
      ),
    ).toEqual(true);

    fUpload.instance().handleDrop([{ name: 'hello.xlsx', size: 200, type: '' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.xlsx
        </p>,
      ),
    ).toEqual(true);
  });

  it('should allow zip and xlsx files by default even if the extensions are all in capital letters and no mime type', () => {
    const fUpload = mount(<FileUpload multiple={false} />);

    fUpload.instance().handleDrop([{ name: 'hello.ZIP', size: 200, type: '' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.ZIP
        </p>,
      ),
    ).toEqual(true);

    fUpload.instance().handleDrop([{ name: 'hello.XLSX', size: 200, type: '' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello.XLSX
        </p>,
      ),
    ).toEqual(true);
  });

  it('should allow zip and xlsx files by default even if they do not have the correct extension but correct mime type', () => {
    const fUpload = mount(<FileUpload multiple={false} />);

    fUpload.instance().handleDrop([{ name: 'hello', size: 200, type: 'application/zip' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello
        </p>,
      ),
    ).toEqual(true);

    fUpload.instance().handleDrop([{ name: 'hello', size: 200, type: 'application/vnd.ms-excel' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello
        </p>,
      ),
    ).toEqual(true);
  });

  it('should allow different fileTypes and optional extensions', () => {
    const fUpload = mount(<FileUpload multiple={false} allowedFileTypes={['text/csv']} allowedExtensions={[/\.csv$/]} />);

    fUpload.instance().handleDrop([{ name: 'hello', size: 200, type: 'text/csv' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          FILES_TO_UPLOAD: hello
        </p>,
      ),
    ).toEqual(true);

    fUpload.instance().handleDrop([{ name: 'hello.csv', size: 200, type: '' }]);

    expect(fUpload.containsMatchingElement(<p data-component="text">FILES_TO_UPLOAD: hello.csv</p>)).toEqual(true);
  });

  it('should show the provided warning if files are not supported', () => {
    const fUpload = mount(
      <FileUpload multiple={false} allowedFileTypes={['text/csv']} allowedExtensions={[/\.csv$/]} invalidFileTypeMessage={'Please provide a csv file'} />,
    );

    fUpload.instance().handleDrop([{ name: 'hello.xml', size: 200, type: 'application/xml' }]);

    expect(
      fUpload.containsMatchingElement(
        <p data-component="text" data-typography-element={true}>
          Please provide a csv file
        </p>,
      ),
    );

    expect(fUpload.containsMatchingElement(<button data-component="button" disabled={true} type="button" />));
  });
});
