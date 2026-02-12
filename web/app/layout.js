import "./globals.css";

export const metadata = {
  title: "iTandem",
  description: "Harvard-Westlake carpool and parking app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
