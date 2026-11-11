import type { NextRequest } from "next/server";
import { ParseTasksRequestSchema } from "@/domain/schemas/api";
import { parseTasksFromText } from "@/ai/tasks";
import { handleAiRequest } from "@/server/ai-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) {
  return handleAiRequest(request, { key: "parse", bodyLimit: 64000, schema: ParseTasksRequestSchema, run: input => parseTasksFromText(input) });
}
