import path from "node:path";
import { recordAudit } from "@/lib/audit";
import { getVerifiedAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/rateLimit";
import { contentTypes, openUploadStream } from "@/lib/storage";

// Quote attachments: owner only, downloaded with their original file name.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await getVerifiedAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.role !== "owner") return new Response("Forbidden", { status: 403 });

  const { name } = await params;
  const quote = await db.quoteRequest.findFirst({ where: { attachmentPath: name } });
  const opened = quote && (await openUploadStream(name, "private"));
  if (!opened) return new Response("Not found", { status: 404 });

  await recordAudit({
    action: "quote.file.download",
    target: `quote:${quote.id}`,
    detail: quote.attachmentName ?? name,
    actor: session,
    ip: clientIpFromHeaders(req.headers),
  });

  const filename = encodeURIComponent(quote.attachmentName ?? name).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(opened.stream, {
    headers: {
      "Content-Type": contentTypes[path.extname(name).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(opened.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
