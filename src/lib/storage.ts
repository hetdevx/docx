import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

// Generic S3-compatible config so this works against MinIO (local dev) or
// a real S3-compatible provider (Cloudflare R2, etc.) with no code change —
// only S3_* env vars differ. Falls back to the local MinIO defaults when
// S3_* isn't set, so existing local dev setups keep working unchanged.
const ENDPOINT =
  process.env.S3_ENDPOINT ??
  `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`;
const REGION = process.env.S3_REGION ?? "us-east-1";
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? process.env.MINIO_ACCESS_KEY!;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? process.env.MINIO_SECRET_KEY!;
const BUCKET = process.env.S3_BUCKET ?? process.env.MINIO_BUCKET ?? "docvault-files";

const client = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

let bucketReady: Promise<void> | null = null;

export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = client
      .send(new HeadBucketCommand({ Bucket: BUCKET }))
      .catch(() => client.send(new CreateBucketCommand({ Bucket: BUCKET })))
      .then(() => undefined);
  }
  return bucketReady;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
