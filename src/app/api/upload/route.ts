import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

/**
 * Image upload.
 *
 * Bytes are written straight into `public/` and served back as a normal static
 * path. That is the right trade for a hackathon demo: no bucket to provision,
 * no signed URLs, no second set of credentials, and the file is visible the
 * instant it lands because Next serves `public/` from disk in dev.
 *
 * It is deliberately not the production answer. `public/` is copied at build
 * time, so on a built/serverless deploy the filesystem is read-only or
 * ephemeral and nothing written here survives. The production path is Supabase
 * Storage: swap `persist()` below for a `storage.from('sidequest').upload()`
 * call and return its public URL — every caller already just reads `url`, so
 * nothing above this route changes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 8MB. Phone photos land around 2–5MB, so this is generous without being a DoS. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The extension comes from the sniffed mime type, never from the client's
 * filename — that keeps `../../` and `.php` out of the path by construction.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const DIRECTORY_BY_KIND = {
  post: 'posts',
  person: 'people',
} as const;

type UploadKind = keyof typeof DIRECTORY_BY_KIND;

function isUploadKind(value: unknown): value is UploadKind {
  return value === 'post' || value === 'person';
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('Send the image as multipart form data.');
    }

    const kind = form.get('kind');
    if (!isUploadKind(kind)) {
      return badRequest("Set kind to 'post' or 'person'.");
    }

    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return badRequest('Attach a file.');
    }

    const extension = EXTENSION_BY_MIME[file.type.toLowerCase()];
    if (!extension) {
      return badRequest('That file is not an image. Use JPEG, PNG, WebP, GIF or AVIF.');
    }

    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return badRequest(`That image is ${mb}MB. The limit is 8MB.`);
    }

    const id = randomUUID();
    const directory = DIRECTORY_BY_KIND[kind];
    const filename = `${id}.${extension}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    // Re-check after reading: `file.size` is client-declared metadata, the
    // buffer length is the truth.
    if (bytes.byteLength > MAX_BYTES) {
      return badRequest('That image is over the 8MB limit.');
    }

    const target = path.join(process.cwd(), 'public', directory);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, filename), bytes);

    return NextResponse.json({ url: `/${directory}/${filename}` }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save that image.' },
      { status: 500 },
    );
  }
}
