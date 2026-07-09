import * as React from "react";
import { OskNameForm } from "./OskNameForm";
import { RoomsSection } from "./RoomsSection";
import { ErrorLogSection } from "./ErrorLogSection";
import { getOskName, updateOskName } from "./api";

// Charakterystyka OSK: nazwa, sale wykładowe. Flota ma własną zakładkę w sidebarze.
export function SettingsSection({ oskId }: { oskId: string }) {
  const [nazwa, setNazwa] = React.useState("");

  React.useEffect(() => {
    void getOskName(oskId).then(setNazwa);
  }, [oskId]);

  return (
    <div className="space-y-6">
      <OskNameForm
        nazwa={nazwa}
        onSave={async (n) => {
          await updateOskName(oskId, n);
          setNazwa(n);
        }}
      />
      <RoomsSection oskId={oskId} />
      <ErrorLogSection oskId={oskId} />
    </div>
  );
}
