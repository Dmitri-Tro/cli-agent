/**
 * Filesystem module constants
 */

export const MAX_FILE_SIZE_FOR_DISPLAY = 1024 * 1024; // 1MB
export const DEFAULT_FILE_ENCODING = 'utf8';

export const DANGEROUS_PATH_PATTERNS = [
  /system32/i, // Windows system directory
  /windows/i, // Windows directory
  /etc\//i, // Unix system directory
  /proc\//i, // Unix process directory
  /dev\//i, // Unix device directory
  /var\/log/i, // Unix log directory
];
