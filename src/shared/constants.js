const FILE_CATEGORIES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff'],
  videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
  code: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.go', '.rs'],
};

const DOWNLOAD_STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const MAX_HISTORY = 100;

module.exports = { FILE_CATEGORIES, DOWNLOAD_STATUS, MAX_HISTORY };
