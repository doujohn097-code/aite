import { verifyIdToken } from '@lib/firebase-admin';
import { getUploadUrl } from '@lib/r2';
import type { NextApiRequest, NextApiResponse } from 'next';

type UploadFile = {
  id: string;
  name: string;
  type: string;
};

type UploadResponseFile = UploadFile & {
  alt: string;
  uploadUrl: string;
  publicUrl: string;
};

export default async function uploadEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<{ files: UploadResponseFile[] } | { error: string }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = await verifyIdToken(token);
    const uid = decoded.uid;

    const { files } = req.body as { files: UploadFile[] };

    if (!Array.isArray(files)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const uploadedFiles = await Promise.all(
      files.map(async ({ id, name, type }) => {
        const safeName = name.replace(/\s+/g, '-');
        const key = `media/${uid}/${id}-${safeName}`;
        const { uploadUrl, publicUrl } = await getUploadUrl(key, type);

        return {
          id,
          name,
          alt: name,
          type,
          uploadUrl,
          publicUrl
        };
      })
    );

    res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate upload URLs' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};
