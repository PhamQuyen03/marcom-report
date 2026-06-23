import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";

const DIAGRAMS_DIR = path.join(process.cwd(), "public/docs/diagrams");

function getValidDiagrams(): string[] {
  try {
    return fs
      .readdirSync(DIAGRAMS_DIR)
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

  const validDiagrams = getValidDiagrams();
  const decoded = decodeURIComponent(slug);

  if (!validDiagrams.includes(decoded)) notFound();

  return (
    <iframe
      src={`/docs/diagrams/${decoded}.html`}
      className="w-full h-screen border-0"
      title="Document"
    />
  );
}
