import NotesView from "@/components/NotesView";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  return <NotesView autoNew={sp.new === "1"} />;
}