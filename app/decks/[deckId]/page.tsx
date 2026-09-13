import type { Metadata } from "next";
import { DeckEditor } from "@/features/editor/components/DeckEditor";

export const metadata: Metadata = {
  title: "Editor",
};

export default async function DeckPage({ params }: PageProps<"/decks/[deckId]">) {
  const { deckId } = await params;
  return <DeckEditor deckId={deckId} />;
}
