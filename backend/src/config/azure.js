const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

const getBlobServiceClient = () => {
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
};

const uploadToAzure = async (file, userId, opts = {}) => {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(process.env.AZURE_CONTAINER_NAME);

  const ext = opts.ext || file.originalname.split('.').pop().toLowerCase();
  const buffer = opts.buffer || file.buffer;
  const contentType = opts.contentType || file.mimetype;
  const blobName = `${userId}/${uuidv4()}.${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });

  // Container is set to Blob-level anonymous read access,
  // so the direct URL is publicly accessible (no SAS needed).
  return {
    url: blockBlobClient.url,
    blobName
  };
};

const deleteFromAzure = async (blobName) => {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(process.env.AZURE_CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
};

module.exports = { uploadToAzure, deleteFromAzure };
