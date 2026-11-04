export type EmojiCategory =
  | 'Emoji'
  | 'Smileys & Emotion'
  | 'People & Body'
  | 'Animals & Nature'
  | 'Food & Drink'
  | 'Activities'
  | 'Travel & Places'
  | 'Objects'
  | 'Symbols'
  | 'Flags';

export const CATEGORY_ORDER: EmojiCategory[] = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Activities',
  'Travel & Places',
  'Objects',
  'Symbols',
  'Flags',
];

export const CATEGORY_LABELS: Record<EmojiCategory, string> = {
  'Smileys & Emotion': 'Smileys & Emotion',
  'People & Body': 'People & Body',
  'Animals & Nature': 'Animals & Nature',
  'Food & Drink': 'Food & Drink',
  'Activities': 'Activities',
  'Travel & Places': 'Travel & Places',
  Objects: 'Objects',
  Symbols: 'Symbols',
  Flags: 'Flags',
  Emoji: 'Emoji',
};

export type LibraryCategory =
  | 'recent'
  | 'uploads'
  | 'saved'
  | 'camera'
  | 'upload'
  | 'photo'
  | 'poll'
  | 'schedule'
  | 'files';

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  'recent',
  'uploads',
  'saved',
  'camera',
  'upload',
  'photo',
  'poll',
  'schedule',
  'files',
];

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  recent: 'Recent',
  uploads: 'Uploads',
  saved: 'Saved',
  camera: 'Camera',
  upload: 'Upload',
  photo: 'Photo',
  poll: 'Poll',
  schedule: 'Schedule',
  files: 'Files',
};
