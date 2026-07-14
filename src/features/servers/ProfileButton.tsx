import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

export function ProfileButton() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [showModal, setShowModal] = useState(false);

  if (!currentUser) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        title={`${currentUser.displayName ?? "You"} — profile & settings`}
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-discord-bg-secondary text-sm font-semibold text-white hover:rounded-2xl"
      >
        {currentUser.avatarUrl ? (
          <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (currentUser.displayName ?? "?").slice(0, 1).toUpperCase()
        )}
      </button>
      {showModal && (
        <ProfileSettingsModal
          currentDisplayName={currentUser.displayName ?? ""}
          currentAvatarUrl={currentUser.avatarUrl}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
