import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";

const DOCS_DIR = path.join(process.cwd(), "public/docs");

function getValidDocs(): string[] {
  try {
    return fs
      .readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, ""));
  } catch {
    return [];
  }
}

export default async function DocumentView({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: segments } = await params;
  const slug = segments?.join("/") ?? "";

  if (!slug) notFound();

  const validDocs = getValidDocs();
  const decoded = decodeURIComponent(slug);

  if (!validDocs.includes(decoded)) notFound();

  return (
    <iframe
      src={`/docs/${decoded}.html`}
      className="w-full h-screen border-0"
      title="Document"
    />
  );
}
