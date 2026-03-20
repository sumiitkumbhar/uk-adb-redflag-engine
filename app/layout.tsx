import "./globals.css";

export const metadata = {
  title: "Risk Scores Viewer",
  description: "Upload a document, process it, and view risk scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
