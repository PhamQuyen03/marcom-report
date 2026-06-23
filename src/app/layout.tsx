import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Marcom Report - Sun Group",
  description: "Báo cáo Marcom Sun Group",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="vi" className="h-full antialiased">
			<body className="min-h-full flex flex-col bg-gray-50">
				{children}
			</body>
		</html>
	);
}
