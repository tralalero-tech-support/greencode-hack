export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  owners?: { displayName: string; emailAddress: string }[];
  lastModifyingUser?: { displayName: string; emailAddress: string };
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  version?: string;
};

export type DriveFileList = {
  files: DriveFile[];
  nextPageToken?: string;
};

export type UploadMetadata = {
  name: string;
  mimeType?: string;
  parents?: string[];
  description?: string;
};

export type DriveSearchParams = {
  query?: string;
  folderId?: string;
  mimeType?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
  fields?: string;
};
