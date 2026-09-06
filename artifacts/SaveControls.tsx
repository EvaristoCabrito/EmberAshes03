import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportSave, importSave, loadSave } from "./save";
import type { SaveData } from "./types";

export function SaveControls({
  onLoaded,
}: {
  onLoaded: (save: SaveData) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ember-save.json";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Save exportado.");
  };

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const next = importSave(text);
      onLoaded(next);
      setMsg("Save importado.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha ao importar.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button size="sm" variant="quiet" onClick={download}>
          Exportar save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
          Importar save
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      {msg && <p className="text-xs text-muted">{msg}</p>}
      <p className="text-[10px] text-muted">
        Cópia de segurança também fica em ember-save.bak. Continuar retoma o combate se houver checkpoint.
      </p>
    </div>
  );
}

export function peekSave(): SaveData {
  return loadSave();
}
