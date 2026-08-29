import React from 'react';
import { SupabaseConfigModal } from './SupabaseConfigModal';

interface GoogleSheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId?: string;
  onSaveSheetId?: (newId: string) => void;
  onRefreshData: () => Promise<void>;
}

export const GoogleSheetConfigModal: React.FC<GoogleSheetConfigModalProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  return (
    <SupabaseConfigModal
      isOpen={isOpen}
      onClose={onClose}
      onRefreshData={onRefreshData}
    />
  );
};
