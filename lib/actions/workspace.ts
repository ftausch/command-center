'use server';

/** Returns true when all Google Drive env vars are set in this deployment. */
export async function isDriveConfigured(): Promise<boolean> {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
  );
}
