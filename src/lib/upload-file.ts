import * as AWS from 'aws-sdk';

const s3 = new AWS.S3({
  region: 'your-region',
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key',
});

export const uploadFile = async (file: any) => {
  const params = {
    Bucket: 'your-bucket-name',
    Key: file.name,
    Body: file,
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully. ${data.Location}`);
  } catch (err) {
    console.log(`Error uploading file: ${err}`);
  }
};