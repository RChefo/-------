export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full page-enter">
      {children}
    </div>
  );
}
