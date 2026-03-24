export type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function readS3ConfigFromEnv(): S3Config {
  const region = process.env.S3_REGION ?? "ap-southeast-1";
  const bucket = process.env.S3_BUCKET ?? "budget-local";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

  return {
    endpoint: process.env.S3_ENDPOINT,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}
