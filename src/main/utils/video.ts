import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import { promisify } from "node:util";
import ffprobeStatic from "ffprobe-static";

interface FfprobeData {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

interface FfprobeFormat {
  duration?: number | string;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number | string;
  height?: number | string;
}

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
}

const CHUNK_SIZE = 64 * 1024;
const execFileAsync = promisify(execFile);

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const runFfprobe = async (filePath: string): Promise<FfprobeData> => {
  const ffprobePath = ffprobeStatic.path;
  if (!ffprobePath) {
    throw new Error("ffprobe binary path is unavailable");
  }

  const args = ["-v", "error", "-show_format", "-show_streams", "-print_format", "json", filePath];

  const { stdout } = await execFileAsync(ffprobePath, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const payload = JSON.parse(stdout) as FfprobeData;
  return payload;
};

const toUnsignedBigInt = (value: bigint): bigint => value & BigInt("0xFFFFFFFFFFFFFFFF");

const readUInt64LE = (buffer: Buffer, offset: number): bigint => {
  return buffer.readBigUInt64LE(offset);
};

export const computeOshash = async (filePath: string): Promise<string> => {
  const handle = await open(filePath, "r");

  try {
    const { size } = await handle.stat();
    if (size < CHUNK_SIZE * 2) {
      throw new Error("File is too small for oshash");
    }

    const head = Buffer.alloc(CHUNK_SIZE);
    const tail = Buffer.alloc(CHUNK_SIZE);

    await handle.read(head, 0, CHUNK_SIZE, 0);
    await handle.read(tail, 0, CHUNK_SIZE, size - CHUNK_SIZE);

    let hash = BigInt(size);

    for (let index = 0; index < CHUNK_SIZE; index += 8) {
      hash = toUnsignedBigInt(hash + readUInt64LE(head, index) + readUInt64LE(tail, index));
    }

    return hash.toString(16).padStart(16, "0");
  } finally {
    await handle.close();
  }
};

export const probeVideoMetadata = async (filePath: string): Promise<VideoMetadata> => {
  const metadata = await runFfprobe(filePath);
  const stream = metadata.streams?.find((candidate: FfprobeStream) => candidate.codec_type === "video");

  return {
    durationSeconds: toNumber(metadata.format?.duration),
    width: toNumber(stream?.width),
    height: toNumber(stream?.height),
  };
};
