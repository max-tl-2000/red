/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { uploadFiles, resetSeedDataState } from 'redux/modules/seedData';
import { Section, Typography } from 'components';
import JobStatus from '../Jobs/JobStatus';
import { cf } from './ImportData.scss';
import ImportDataSection from './ImportDataSection';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isCustomerAdmin } from '../../../common/helpers/auth';

const { Text } = Typography;

const ImportDataComponent = {
  IMPORT_EXCEL: 'Import Excel',
  IMPORT_ASSETS: 'Import assets',
  YARDI_DATA: 'Yardi data',
  IMPORT_UPDATES: 'Import updates',
  IMPORT_RMS: 'Import RMS',
  IMPORT_VOICE_MESSAGES: 'Import voice message mp3 files',
};

@connect(
  state => ({
    authUser: state.auth.user,
  }),
  dispatch => ({
    seedDataActions: bindActionCreators(
      {
        uploadFiles,
        resetSeedDataState,
      },
      dispatch,
    ),
  }),
)
export default class ImportData extends Component {
  componentWillUnmount() {
    this.props.seedDataActions.resetSeedDataState();
  }

  csvMimeTypes = ['text/csv'];

  xmlTypes = ['text/xml', 'application/xml'];

  csvExtensionsRegex = [/\.csv$/i];

  xmlExtensionsRegex = [/\.xml/];

  render = ({ authUser = {} } = this.props) => {
    const { csvMimeTypes, csvExtensionsRegex, xmlTypes, xmlExtensionsRegex } = this;
    const isCustomerAdminUser = isCustomerAdmin(authUser);

    return (
      <div>
        <ImportDataSection
          componentName={ImportDataComponent.IMPORT_EXCEL}
          multiple={false}
          labels={{
            title: t('SEED_PROPERTY_DATA_HEADER'),
            placeholder: t('DROPZONE_PROPERTY_MESSAGE'),
            buttonLabel: t('UPLOAD_PROPERTY_FILES'),
            invalidFileTypeMessage: t('INVALID_PROPERTY_FILE_TYPE'),
          }}
          onUpload={(files, client) => this.props.seedDataActions.uploadFiles(ImportDataComponent.IMPORT_EXCEL, '/seedData', files, client)}
        />
        {!isCustomerAdminUser && (
          <div>
            <ImportDataSection
              componentName={ImportDataComponent.IMPORT_ASSETS}
              multiple={false}
              labels={{
                title: t('SEED_PROPERTY_IMAGES_HEADER'),
                placeholder: t('DROPZONE_PROPERTY_MESSAGE'),
                buttonLabel: t('UPLOAD_PROPERTY_FILES'),
                invalidFileTypeMessage: t('INVALID_PROPERTY_FILE_TYPE'),
              }}
              onUpload={(files, client) => this.props.seedDataActions.uploadFiles(ImportDataComponent.IMPORT_ASSETS, '/seedData', files, client)}
            />
            <ImportDataSection
              componentName={ImportDataComponent.IMPORT_VOICE_MESSAGES}
              multiple={false}
              labels={{
                title: t('SEED_VOICE_FILES_HEADER'),
                placeholder: t('DROPZONE_VOICE_MESSAGE'),
                buttonLabel: t('UPLOAD_VOICE_FILES'),
                invalidFileTypeMessage: t('INVALID_IMPORT_VOICE_MESSAGES_FILE_TYPE'),
              }}
              onUpload={(files, client) =>
                this.props.seedDataActions.uploadFiles(ImportDataComponent.IMPORT_VOICE_MESSAGES, '/importVoiceMessages', files, client)
              }
            />
            <ImportDataSection
              componentName={ImportDataComponent.YARDI_DATA}
              multiple={true}
              allowedFileTypes={csvMimeTypes}
              allowedExtensions={csvExtensionsRegex}
              labels={{
                title: t('YARDI_DATA_HEADER'),
                placeholder: t('DROPZONE_YARDI_MESSAGE'),
                buttonLabel: t('UPLOAD_YARDI_FILES'),
                invalidFileTypeMessage: t('INVALID_YARDI_FILE_TYPE'),
              }}
              onUpload={(files, client) => this.props.seedDataActions.uploadFiles(ImportDataComponent.YARDI_DATA, '/migrateData', files, client)}
            />
            <ImportDataSection
              componentName={ImportDataComponent.IMPORT_UPDATES}
              multiple={true}
              allowedFileTypes={csvMimeTypes}
              allowedExtensions={csvExtensionsRegex}
              labels={{
                title: t('IMPORT_UPDATES_DATA_HEADER'),
                placeholder: t('DROPZONE_IMPORT_UPDATES_MESSAGE'),
                buttonLabel: t('UPLOAD_IMPORT_UPDATES_FILES'),
                invalidFileTypeMessage: t('INVALID_IMPORT_UPDATES_FILE_TYPE'),
              }}
              onUpload={(files, client) => this.props.seedDataActions.uploadFiles(ImportDataComponent.IMPORT_UPDATES, '/importUpdates', files, client)}
            />
            <ImportDataSection
              componentName={ImportDataComponent.IMPORT_RMS}
              multiple={true}
              allowedFileTypes={xmlTypes}
              allowedExtensions={xmlExtensionsRegex}
              labels={{
                title: t('IMPORT_RMS_DATA_HEADER'),
                placeholder: t('DROPZONE_PROPERTY_MESSAGE'),
                buttonLabel: t('UPLOAD_PROPERTY_FILES'),
                invalidFileTypeMessage: t('INVALID_IMPORT_RMS_FILE_TYPE'),
              }}
              onUpload={(files, client) => this.props.seedDataActions.uploadFiles(ImportDataComponent.IMPORT_RMS, '/importRms', files, client)}
            />
          </div>
        )}

        <Section title={t('JOBS_STATUS')}>
          <JobStatus jobCategory={DALTypes.JobCategory.MigrateData} />
        </Section>
        <div className={cf('item-count-notification')}>
          <Text inline>{t('IMPORT_ADMIN_JOBS_COUNT_NOTICE')}</Text>
        </div>
      </div>
    );
  };
}
