/** 有界校验编码与文件签名；完整图像解码仍由图像处理/模型服务完成。 */
export function isSupportedImageDataUrl(value: string): boolean {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(value);
  if (!match) return false;
  const encoded = value.slice(match[0].length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-3)!) & 15) !== 0) return false;
  if (encoded.endsWith("=") && !encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-2)!) & 3) !== 0) return false;
  let header: string;
  try { header = atob(encoded.slice(0, 32)); } catch { return false; }
  if (match[1] === "image/png") return header.startsWith("\x89PNG\r\n\x1a\n") && header.slice(12, 16) === "IHDR";
  if (match[1] === "image/jpeg") return header.startsWith("\xff\xd8\xff");
  return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(header.slice(12, 16));
}
