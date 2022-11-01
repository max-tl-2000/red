/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error, log } from 'clix-logger/logger';
import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';
import minimist from 'minimist';
import sleep from '../../common/helpers/sleep';
import { write, exists, tryReadJSON, mkdirp, deleteFile } from '../../common/helpers/xfs';
import { DOWNLOADS_DIR, DOWNLOADED_GDRIVE_FILES_FILE_PATH } from './helpers/property-setup-sheet-tests';

const CREDENTIALS_FILE = 'credentials.json';
// If modifying these scopes, delete token.json
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'];
// The file token.json stores the user's access and refresh tokens
const TOKEN_PATH = 'token.json';

/**
 * Get an OAuth2 client
 * @param {Object} credentials The authorization client credentials
 */
const getOAuth2Client = credentials => {
  const { client_secret, client_id, redirect_uris } = credentials.installed; // eslint-disable-line camelcase
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
};

/**
 * Get and store new token after prompting for user authorization
 * @param {Object} credentials The authorization client credentials
 */
const getAccessToken = async credentials => {
  const client = getOAuth2Client(credentials);

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\nAuthorize this app by visiting this url:');
  console.log(`\n${authUrl}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('\nEnter the code in the page here: ', code => {
      rl.close();
      client.getToken(code, async (getTokenError, token) => {
        if (getTokenError) reject(getTokenError);

        await write(TOKEN_PATH, JSON.stringify(token));
        console.log(`\nUser google drive token saved to: ${TOKEN_PATH}\n`);

        resolve();
      });
    });
  });
};

/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials
 */
const authorize = async credentials => {
  const client = getOAuth2Client(credentials);

  if (!(await exists(TOKEN_PATH))) {
    await getAccessToken(credentials);
  }

  client.setCredentials(await tryReadJSON(TOKEN_PATH));

  return client;
};

const deleteFileIfExists = async filePath => (await exists(filePath)) && (await deleteFile(filePath));

const logDownloadedFiles = async (files = []) => {
  await deleteFileIfExists(DOWNLOADED_GDRIVE_FILES_FILE_PATH);
  await write(DOWNLOADED_GDRIVE_FILES_FILE_PATH, JSON.stringify({ files }));
};

/**
 * Export a Google sheet to XLSX format
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param fileId The file id of the google sheet to export
 * @param fileName Name of the file to save the exported sheet
 */
export const exportSheetToXLSX = async (auth, fileId, fileName) => {
  const exportFilePath = `${DOWNLOADS_DIR}/${fileName}.xlsx`;
  await mkdirp(DOWNLOADS_DIR);

  await deleteFileIfExists(exportFilePath);

  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: 'v3', auth });
    const exportedFile = fs.createWriteStream(exportFilePath);
    exportedFile
      .on('finish', () => {
        resolve(exportFilePath);
      })
      .on('error', exportError => {
        reject(exportError);
      });

    drive.files
      .export(
        {
          fileId,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        { responseType: 'stream' },
      )
      .then(response => {
        if (!response?.data) {
          reject(new Error('No file data in the response!'));
          return;
        }

        response.data.pipe(exportedFile);
      })
      .catch(err => reject(err));
  });
};

/**
 * Get a Google sheet's data from a given id
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param fileId The google sheet file id
 */
const getSheetDataFromFileId = async (auth, fileId) => {
  const drive = google.drive({ version: 'v3', auth });

  const options = {
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    pageSize: 1000,
    fields: 'nextPageToken, files(id, name, owners, modifiedTime)',
    includeTeamDriveItems: true,
    supportsTeamDrives: true,
  };

  return new Promise((resolve, reject) => {
    drive.files.list(options, (listError, { data }) => {
      if (listError) {
        reject(listError);
        return;
      }

      const { files = [] } = data;
      const file = files.find(f => f.id === fileId);

      if (!file) {
        reject(new Error('File not found'));
        return;
      }

      resolve({ fileName: file.name, modifiedTime: file.modifiedTime });
    });
  });
};

const getGDriveCredentials = async () => {
  if (!(await exists(CREDENTIALS_FILE))) {
    error(`
      Go to: https://developers.google.com/drive/api/v3/quickstart/nodejs 
      and follow the instructions to turn on the Drive API.

      Download the ${CREDENTIALS_FILE} and copy it to the project root directory.
    `);
    throw new Error(`Credentials file ${CREDENTIALS_FILE} does not exist!`);
  }

  return await tryReadJSON(CREDENTIALS_FILE);
};

const getArgs = args => {
  const argv = minimist(args.slice(2));

  return {
    fileIds: argv.fileIds?.split(',') || [],
  };
};

/*
  Usage: ./bnr google-drive-downloader
  Options:
    --fileIds=<sheetId1,sheetId2,...> set which property sheets to download
*/
const main = async args => {
  const credentials = await getGDriveCredentials();
  const auth = await authorize(credentials);

  const { fileIds } = getArgs(args);

  const downloadedFiles = await Promise.all(
    fileIds.map(async fileId => {
      let exportedSheetPath;
      let modifiedTime;

      const maxAttempts = 3;
      let attempt = 1;
      let downloadSuccessful = false;
      while (attempt <= maxAttempts && !downloadSuccessful) {
        try {
          log('Try ', attempt, ' downloading file:', fileId);

          const sheetData = await getSheetDataFromFileId(auth, fileId);
          modifiedTime = sheetData.modifiedTime;

          exportedSheetPath = await exportSheetToXLSX(auth, fileId, sheetData.fileName);
          log('Finished downloading file:', exportedSheetPath);
          downloadSuccessful = true;
        } catch (exportSheetError) {
          if (attempt++ === maxAttempts) {
            throw exportSheetError;
          }
          const waitToRetry = Math.floor(Math.random() * 100) * 100 + 100000;
          log('  Failed downloading file. \n Error: ', exportSheetError, '. \n . Waiting ', waitToRetry / 1000, ' seconds to retry .. ');
          await sleep(waitToRetry);
        }
      }

      return { fileId, filePath: exportedSheetPath, modifiedTime };
    }),
  );

  await logDownloadedFiles(downloadedFiles);
};

main(process.argv)
  .then(process.exit)
  .catch(err => {
    error(err);
    process.exit(1); // eslint-disable-line no-process-exit
  });
