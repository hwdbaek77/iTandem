import Header from "./Header";
import BottomNav from "./BottomNav";

export default function AppShell({ children }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">
      <Header />
      <main className="px-4 pb-24 pt-20">{children}</main>
      <BottomNav />
    </div>
  );
}
