/**
 * SettingsModal - Modal wrapper for the settings page
 */

import { Modal } from '../common';
import { SettingsPage } from './SettingsPage';
import { useUIStore } from '../../stores';

export function SettingsModal() {
  const { activeModal, closeModal } = useUIStore();
  const isOpen = activeModal === 'settings';

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      size="xl"
      closeOnOverlayClick={false}
    >
      <div className="h-[70vh] -m-6">
        <SettingsPage onClose={closeModal} />
      </div>
    </Modal>
  );
}
