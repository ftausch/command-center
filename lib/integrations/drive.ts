// Google Drive integration — creates project folders via OAuth2 refresh token.
//
// Required env vars (all server-side only):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN
//   GOOGLE_DRIVE_PARENT_FOLDER_ID  — ID of the folder where project folders go

import 'server-only';
import { google } from 'googleapis';

export interface CreateFolderResult {
  folderId: string;
  folderName: string;
  url: string;
  subfolders: { name: string; id: string }[];
}

// Subfolders created inside every new project folder.
const PROJECT_SUBFOLDERS = [
  '01 Aufnahme',
  '02 Schnitt',
  '03 Thumbnail',
  '04 Show Notes',
  '05 Distribution',
];

function getDriveClient() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * Create a project folder (with standard subfolders) inside the configured
 * parent folder. Returns null when Drive is not configured or on error.
 */
export async function createProjectFolder(
  projectName: string,
): Promise<CreateFolderResult | null> {
  const drive    = getDriveClient();
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  if (!drive || !parentId) {
    console.warn('[drive] createProjectFolder: not configured (missing env vars)');
    return null;
  }

  try {
    // Create the main project folder.
    // supportsAllDrives: true is required for Google Workspace Shared Drives.
    const folderRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name:     projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents:  [parentId],
      },
      fields: 'id,name,webViewLink',
    });

    const folderId  = folderRes.data.id!;
    const folderUrl = folderRes.data.webViewLink
      ?? `https://drive.google.com/drive/folders/${folderId}`;

    // Create subfolders in parallel.
    const subfolderResults = await Promise.all(
      PROJECT_SUBFOLDERS.map((name) =>
        drive.files.create({
          supportsAllDrives: true,
          requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents:  [folderId],
          },
          fields: 'id,name',
        }).then((r) => ({ name, id: r.data.id! })),
      ),
    );

    console.log(`[drive] ✓ created folder "${projectName}" (${folderId}) with ${subfolderResults.length} subfolders`);

    return {
      folderId,
      folderName: projectName,
      url: folderUrl,
      subfolders: subfolderResults,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const detail = e?.response?.data?.error?.message ?? e?.message ?? String(e);
    console.error(`[drive] createProjectFolder failed (${status ?? 'no status'}): ${detail}`);
    return null;
  }
}

/** Returns true when all required Drive env vars are present. */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  );
}
