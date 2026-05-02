const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

const getBlobServiceClient = () => {
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
};

const uploadToAzure = async (file, userId) => {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(process.env.AZURE_CONTAINER_NAME);

  const ext = file.originalname.split('.').pop().toLowerCase();
  const blobName = `${userId}/${uuidv4()}.${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype }
  });

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
