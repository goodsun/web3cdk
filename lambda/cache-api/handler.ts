import serverlessExpress from '@codegenie/serverless-express';
import app from './app';

export const handler = serverlessExpress({ 
  app,
  binaryMimeTypes: [
    'application/octet-stream',
    'image/*',
    'audio/*',
    'video/*'
  ]
});