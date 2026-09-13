import type { Metadata } from "next";
import { PrintDeck } from "@/features/export/components/PrintDeck";

export const metadata: Metadata = {
  title: "Export",
};

export default async function PrintPage({ params }: PageProps<"/decks/[deckId]/print">) {
  const { deckId } = await params;
  return <PrintDeck deckId={deckId} />;
}
