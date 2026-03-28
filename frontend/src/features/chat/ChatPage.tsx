import { AlertCircle } from "lucide-react";
import ChatInterface from "./components/ChatInterface";
import { useDataset } from "@/shared/data/DataContext";

export default function ChatPage() {
  const { dataset } = useDataset();

  if (!dataset) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-3 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="font-semibold text-foreground">No Dataset Loaded</p>
          <p className="text-sm text-muted-foreground">
            Please upload a dataset first to start chatting
          </p>
        </div>
      </div>
    );
  }

  return <ChatInterface />;
}
