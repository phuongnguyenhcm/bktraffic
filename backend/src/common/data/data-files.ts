import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolve đường dẫn file trong thư mục dữ liệu.
 * Dùng process.cwd() (ESM không có __dirname) — process chạy tại /backend.
 */
export function resolveDataPath(dataDir: string, fileName: string): string {
  return path.resolve(process.cwd(), dataDir, fileName);
}

/**
 * Parser CSV tối giản (RFC 4180): hỗ trợ trường có dấu ngoặc kép chứa dấu phẩy,
 * escape `""`, và xuống dòng CRLF/LF.
 */
export function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  return nonEmpty.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => (rec[h] = (r[idx] ?? '').trim()));
    return rec;
  });
}

/**
 * Cache nội dung file theo mtime: file được đọc lại tự động khi thay đổi
 * (thuận tiện khi một tiến trình mô phỏng ghi thêm dữ liệu vào speed.csv).
 */
export class MtimeCachedFile<T> {
  private cached: { mtimeMs: number; value: T } | null = null;
  private loading: Promise<T> | null = null;

  constructor(
    private readonly filePath: string,
    private readonly transform: (content: string) => T,
  ) {}

  async get(): Promise<T> {
    const { mtimeMs } = await stat(this.filePath);
    if (this.cached && this.cached.mtimeMs === mtimeMs) return this.cached.value;
    if (this.loading) return this.loading;

    this.loading = readFile(this.filePath, 'utf8')
      .then((content) => {
        const value = this.transform(content);
        this.cached = { mtimeMs, value };
        return value;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }
}
