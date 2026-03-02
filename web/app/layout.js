import "./globals.css";
import Providers from "../components/Providers";

export const metadata = {
  title: "iTandem",
  description: "Harvard-Westlake carpool and parking app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
