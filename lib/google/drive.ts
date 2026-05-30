import { google } from "googleapis";
import type { OAuth2Client } from "googleapis-common";
import type { Readable } from "stream";
import type { DriveFile, DriveFileList, DriveSearchParams, UploadMetadata } from "./types";

const DEFAULT_FILE_FIELDS =
  "id,name,mimeType,modifiedTime,createdTime,size,parents,webViewLink,owners,lastModifyingUser,description,starred,trashed,version";

function getDriveClient(auth: OAuth2Client) {
  return google.drive({ version: "v3", auth });
}

export async function listFiles(
  auth: OAuth2Client,
  params: DriveSearchParams = {}
): Promise<DriveFileList> {
  const drive = getDriveClient(auth);

  const queryParts: string[] = ["trashed = false"];
  if (params.folderId) queryParts.push(`'${params.folderId}' in parents`);
  if (params.mimeType)  queryParts.push(`mimeType = '${params.mimeType}'`);
  if (params.query)     queryParts.push(params.query);

  const res = await drive.files.list({
    q:          queryParts.join(" and "),
    pageSize:   params.pageSize ?? 50,
    pageToken:  params.pageToken,
    orderBy:    params.orderBy ?? "modifiedTime desc",
    fields:     `nextPageToken, files(${params.fields ?? DEFAULT_FILE_FIELDS})`,
  });

  return {
    files:         (res.data.files ?? []) as DriveFile[],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function getFile(auth: OAuth2Client, fileId: string): Promise<DriveFile> {
  const drive = getDriveClient(auth);
  const res = await drive.files.get({
    fileId,
    fields: DEFAULT_FILE_FIELDS,
  });
  return res.data as DriveFile;
}

export async function searchFiles(
  auth: OAuth2Client,
  query: string,
  params: Omit<DriveSearchParams, "query"> = {}
): Promise<DriveFileList> {
  return listFiles(auth, {
    ...params,
    query: `fullText contains '${query.replace(/'/g, "\\'")}'`,
  });
}

export async function uploadFile(
  auth: OAuth2Client,
  metadata: UploadMetadata,
  body: Readable | Buffer | string
): Promise<DriveFile> {
  const drive = getDriveClient(auth);
  const res = await drive.files.create({
    requestBody: {
      name:        metadata.name,
      mimeType:    metadata.mimeType,
      parents:     metadata.parents,
      description: metadata.description,
    },
    media: {
      mimeType: metadata.mimeType ?? "application/octet-stream",
      body,
    },
    fields: DEFAULT_FILE_FIELDS,
  });
  return res.data as DriveFile;
}

export async function updateFileMetadata(
  auth: OAuth2Client,
  fileId: string,
  metadata: Partial<UploadMetadata>
): Promise<DriveFile> {
  const drive = getDriveClient(auth);
  const res = await drive.files.update({
    fileId,
    requestBody: {
      name:        metadata.name,
      description: metadata.description,
    },
    fields: DEFAULT_FILE_FIELDS,
  });
  return res.data as DriveFile;
}

export async function downloadFile(
  auth: OAuth2Client,
  fileId: string
): Promise<Readable> {
  const drive = getDriveClient(auth);
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return res.data as unknown as Readable;
}

export async function exportGoogleDoc(
  auth: OAuth2Client,
  fileId: string,
  mimeType: string
): Promise<Readable> {
  const drive = getDriveClient(auth);
  const res = await drive.files.export(
    { fileId, mimeType },
    { responseType: "stream" }
  );
  return res.data as unknown as Readable;
}

export async function deleteFile(auth: OAuth2Client, fileId: string): Promise<void> {
  const drive = getDriveClient(auth);
  await drive.files.delete({ fileId });
}

export async function createFolder(
  auth: OAuth2Client,
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = getDriveClient(auth);
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents:  parentId ? [parentId] : undefined,
    },
    fields: DEFAULT_FILE_FIELDS,
  });
  return res.data as DriveFile;
}

export async function listFileRevisions(auth: OAuth2Client, fileId: string) {
  const drive = getDriveClient(auth);
  const res = await drive.revisions.list({
    fileId,
    fields: "revisions(id,modifiedTime,lastModifyingUser,size,keepForever)",
  });
  return res.data.revisions ?? [];
}

export async function getFilePermissions(auth: OAuth2Client, fileId: string) {
  const drive = getDriveClient(auth);
  const res = await drive.permissions.list({
    fileId,
    fields: "permissions(id,type,role,emailAddress,displayName)",
  });
  return res.data.permissions ?? [];
}
