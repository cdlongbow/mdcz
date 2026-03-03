declare module "opencc-js" {
  export interface ConverterOptions {
    from?: "cn" | "tw" | "twp" | "hk" | "jp" | "t";
    to?: "cn" | "tw" | "twp" | "hk" | "jp" | "t";
  }

  export function Converter(options?: ConverterOptions): (input: string) => string;
}

declare module "ffprobe-static" {
  const ffprobeStatic: { path: string };
  export default ffprobeStatic;
}

declare module "fluent-ffmpeg" {
  export interface FfprobeStream {
    codec_type?: string;
    width?: number;
    height?: number;
  }

  export interface FfprobeData {
    format: { duration?: number | string };
    streams: FfprobeStream[];
  }

  export interface FfmpegStatic {
    ffprobe(filePath: string, callback: (error: Error | null, data: FfprobeData) => void): void;
    setFfprobePath(path: string): void;
  }

  const ffmpeg: FfmpegStatic;
  export default ffmpeg;
}
