import type { NextRequest } from "next/server";
import { ReplanRequestSchema } from "@/domain/schemas/api";
import { replanForDay } from "@/ai/tasks";
import { handleAiRequest } from "@/server/ai-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: NextRequest) {
  return handleAiRequest(request, { key: "replan", bodyLimit: 6000000, schema: ReplanRequestSchema, run: input => replanForDay(input) });
}
