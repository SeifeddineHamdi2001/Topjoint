import path from "node:path";
import { contentTypes, openUploadStream } from "@/lib/storage";

// Public product photos uploaded from the admin.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const opened = await openUploadStream(name, "public");
  if (!opened) return new Response("Not found", { status: 404 });

  if (req.headers.get("if-none-match") === opened.etag) {
    opened.stream.cancel().catch(() => {});
    return new Response(null, {
      status: 304,
      headers: {
        ETag: opened.etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return new Response(opened.stream, {
    headers: {
      "Content-Type": contentTypes[path.extname(name).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(opened.size),
      ETag: opened.etag,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
