"use client";

import { useParams } from "next/navigation";

export default function ReportView() {
  const params = useParams();
  const path = Array.isArray(params.path) ? params.path.join("/") : "";

  if (!path) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Report not found</p>
      </div>
    );
  }

  return (
    <iframe
      src={`/reports/${path}.html`}
      className="w-full h-screen border-0"
      title="Report"
    />
  );
}
