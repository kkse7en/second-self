import type { NextRequest } from "next/server";
import { ParseImageRequestSchema } from "@/domain/schemas/api";
import { parseTasksFromImage } from "@/ai/tasks";
import { handleAiRequest } from "@/server/ai-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) {
  return handleAiRequest(request, { key: "parse-image", bodyLimit: 3210000, rateLimit: 5, schema: ParseImageRequestSchema, run: input => parseTasksFromImage(input) });
}
