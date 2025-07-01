import serverlessExpress from '@vendia/serverless-express';
import app from './app';

export const handler = serverlessExpress({ 
  app,
  binaryMimeTypes: [
    'image/png',
    'image/jpeg', 
    'image/webp',
    'image/gif'
    // SVG is text-based and should not be treated as binary
  ]
});