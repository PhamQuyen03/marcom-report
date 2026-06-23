import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";

const REPORTS_DIR = path.join(process.cwd(), "public/reports");

function getValidReports(): string[] {
  try {
    return fs
      .readdirSync(REPORTS_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, ""));
  } catch {
    return [];
  }
}

export default async function ReportView({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: segments } = await params;
  const slug = segments?.join("/") ?? "";

  if (!slug) notFound();

  const validReports = getValidReports();
  const decoded = decodeURIComponent(slug);

  if (!validReports.includes(decoded)) notFound();

  return (
    <iframe
      src={`/reports/${decoded}.html`}
      className="w-full h-screen border-0"
      title="Report"
    />
  );
}
